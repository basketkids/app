class PartidosGlobalesApp {
  constructor(dataService) {
    this.dataService = dataService;
    this.partido = null;
    this.refrescoInterval = null;
    this.segundosRestantes = 0; // Para controlar display tiempo
    this.parteActual = 1;       // Para controlar el cuarto actual
    this.matchRenderer = new MatchRenderer();
    this.teamService = new TeamService(); // Supabase logic inside
    this.currentUser = null;
    this.supabase = window.supabaseClient;

    // Auth listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session ? session.user : null;
      if (this.partido) {
        this.updateFollowButton();
        this.updateRequestButton();
      }
    });

    // Bind events
    const followBtn = document.getElementById('followBtn');
    if (followBtn) {
      followBtn.addEventListener('click', () => this.toggleFollow());
    }
    const requestAccessBtn = document.getElementById('requestAccessBtn');
    if (requestAccessBtn) {
      requestAccessBtn.addEventListener('click', () => this.requestAccess());
    }
  }

  cargarPartidoGlobal(partidoId) {
    return this.dataService.getPartidoGlobal(partidoId)
      .then(partido => {
        if (!partido) throw new Error("Partido no encontrado o no inicializado (live_state vacío)");

        this.partido = partido;
        // Ensure some fields are present
        this.partido.id = partidoId;

        // Obtén el último evento válido para establecer cuarto y tiempo
        const eventosArray = partido.eventos ? Object.values(partido.eventos) : [];
        if (eventosArray.length > 0) {
          eventosArray.sort((a, b) => {
            if (a.cuarto === b.cuarto) return b.tiempoSegundos - a.tiempoSegundos;
            return b.cuarto - a.cuarto;
          });
          const ultimoEvento = eventosArray[0];

          this.parteActual = ultimoEvento.cuarto || 1;
          const duracionParte = partido.duracionParte || 600;
          this.segundosRestantes = duracionParte - (ultimoEvento.tiempoSegundos || 0);
          if (this.segundosRestantes < 0) this.segundosRestantes = 0;
        } else {
          this.parteActual = 1;
          this.segundosRestantes = this.partido.duracionParte || 600;
        }
        this.renderizarPartido();
        this.iniciarRefrescoSiEnCurso();
        this.updateFollowButton();
        this.updateRequestButton();
      })
      .catch(error => {
        console.error('Error cargando partido global:', error);
        // this.mostrarError('No se pudo cargar el partido global.');
      });
  }

  async updateRequestButton() {
    const btn = document.getElementById('requestAccessBtn');
    if (!btn || !this.partido || !this.currentUser) {
      if (btn) btn.style.display = 'none';
      return;
    }

    // Don't show if user is owner
    if (this.currentUser.id === this.partido.ownerUid) { // Supabase user has .id, not .uid
      btn.style.display = 'none';
      return;
    }

    // Check if already has request
    try {
      const { data, error } = await this.supabase
        .from('match_requests')
        .select('*')
        .eq('match_id', this.partido.id)
        .eq('user_id', this.currentUser.id)
        .maybeSingle();

      if (data) {
        // Request exists
        btn.style.display = 'inline-block';
        btn.disabled = true;

        if (data.status === 'accepted') {
          btn.innerHTML = '<i class="bi bi-check-circle"></i> Aceptada';
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-success');
        } else if (data.status === 'rejected') {
          btn.innerHTML = '<i class="bi bi-x-circle"></i> Rechazada';
          btn.classList.add('btn-danger');
        } else {
          btn.innerHTML = '<i class="bi bi-clock-history"></i> Solicitud enviada';
          btn.classList.remove('btn-outline-warning');
          btn.classList.add('btn-secondary');
        }

      } else {
        btn.style.display = 'inline-block';
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-pencil-square"></i> Solicitar ser anotador';
        btn.classList.add('btn-outline-warning');
        btn.classList.remove('btn-secondary');
      }
    } catch (e) {
      console.error("Error checking request status", e);
    }
  }

  async requestAccess() {
    if (!this.currentUser || !this.partido) return;

    if (!confirm("¿Quieres solicitar permiso al propietario para anotar estadísticas en este partido?")) return;

    try {
      // Create match_request
      const { error } = await this.supabase
        .from('match_requests')
        .insert([
          {
            match_id: this.partido.id,
            user_id: this.currentUser.id,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      // Create notification for owner
      // owner_id (Supabase needs to know who the owner is).
      // this.partido.ownerUid came from DataService/match object via Firebase style?
      // DataService loading from matches table... 'matches' table has 'team_id'.
      // 'teams' table has 'owner_id'.
      // We actually need to join or fetch owner_id if not present in match object.
      // match object loaded via DataService.getPartidoGlobal comes from live_state?

      let ownerId = this.partido.ownerUid;
      if (!ownerId && this.partido.equipoId) {
        // fetch team owner
        const { data: team } = await this.supabase.from('teams').select('owner_id').eq('id', this.partido.equipoId).single();
        if (team) ownerId = team.owner_id;
      }

      if (ownerId) {
        await this.supabase.from('notifications').insert([{
          user_id: ownerId,
          type: 'scorer_request',
          title: 'Solicitud de anotador',
          message: `${this.currentUser.email || 'Alguien'} quiere anotar en tu partido.`,
          data: {
            matchId: this.partido.id,
            requesterId: this.currentUser.id
          }
        }]);
      }

      alert("Solicitud enviada. El propietario debe aprobarla.");
      this.updateRequestButton();

    } catch (e) {
      console.error("Error sending request", e);
      alert("Error al enviar solicitud: " + e.message);
    }
  }

  async updateFollowButton() {
    const followBtn = document.getElementById('followBtn');

    if (!followBtn || !this.partido || !this.partido.equipoId) {
      // Need equipoId to follow
      return;
    }

    // ownerUid needed? TeamService uses teamId mainly now?
    // TeamService.followTeam(ownerUid, teamId, userUid) -> implementation uses team_id. ownerUid used for notification only.

    let ownerId = this.partido.ownerUid; // Might be missing in live_state if not populated
    if (!ownerId) {
      // try fetch
      const { data: team } = await this.supabase.from('teams').select('owner_id').eq('id', this.partido.equipoId).single();
      if (team) ownerId = team.owner_id;
      this.partido.ownerUid = ownerId;
    }

    if (!ownerId) return; // Can't follow without owner/team

    followBtn.style.display = 'inline-block';

    if (!this.currentUser) {
      followBtn.innerHTML = '<i class="bi bi-heart"></i> Seguir Equipo';
      followBtn.classList.remove('btn-primary');
      followBtn.classList.add('btn-outline-primary');
      return;
    }

    try {
      const isFollowing = await this.teamService.isFollowing(ownerId, this.partido.equipoId, this.currentUser.id);
      if (isFollowing) {
        followBtn.innerHTML = '<i class="bi bi-heart-fill"></i> Siguiendo';
        followBtn.classList.remove('btn-outline-primary');
        followBtn.classList.add('btn-primary');
      } else {
        followBtn.innerHTML = '<i class="bi bi-heart"></i> Seguir Equipo';
        followBtn.classList.remove('btn-primary');
        followBtn.classList.add('btn-outline-primary');
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }

  async toggleFollow() {
    if (!this.partido || !this.partido.ownerUid || !this.partido.equipoId) return;

    if (!this.currentUser) {
      alert("Debes iniciar sesión para seguir a un equipo.");
      return;
    }

    const followBtn = document.getElementById('followBtn');
    followBtn.disabled = true;

    try {
      const isFollowing = await this.teamService.isFollowing(this.partido.ownerUid, this.partido.equipoId, this.currentUser.id);
      if (isFollowing) {
        await this.teamService.unfollowTeam(this.partido.ownerUid, this.partido.equipoId, this.currentUser.id);
      } else {
        await this.teamService.followTeam(this.partido.ownerUid, this.partido.equipoId, this.currentUser.id);
      }
      this.updateFollowButton();
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Error al actualizar seguimiento: ' + error.message);
    } finally {
      followBtn.disabled = false;
    }
  }

  renderizarPartido() {
    if (!this.partido) return;

    // Renderizar nombre del partido
    const nombreElem = document.getElementById('nombrePartido');
    if (nombreElem) nombreElem.textContent = (this.partido.nombreEquipo || 'Equipo') + " vs " + (this.partido.nombreRival || 'Rival');

    const ne = document.getElementById('nombreEquipoMarcador');
    if (ne) ne.textContent = this.partido.nombreEquipo;

    const nr = document.getElementById('nombreEquipoRival');
    if (nr) nr.textContent = this.partido.nombreRival;

    const estado = document.getElementById('divEstado');
    if (estado) estado.textContent = this.partido.estado;
    // Renderizar marcador equipo
    const marcadorEquipo = document.getElementById('marcadorEquipo');
    if (marcadorEquipo) marcadorEquipo.textContent = this.partido.puntosEquipo || 0;

    // Renderizar marcador rival
    const marcadorRival = document.getElementById('marcadorRival');
    if (marcadorRival) marcadorRival.textContent = this.partido.puntosRival || 0;

    this.actualizarLucesFaltas();
    this.actualizarDisplay();
    this.actualizarOrdenMarcador(); // New order logic
    this.renderParciales();         // New partials logic

    // Renderizar jugadores convocados
    this.renderizarEstadisticas();

    // Opcional: Renderizar lista básica de eventos en vivo
    this.renderEventosEnVivo();

    // Update Other Matches Button
    const otherMatchesBtn = document.getElementById('otherMatchesBtn');
    if (otherMatchesBtn && this.partido.equipoId) {
      otherMatchesBtn.href = `index.html?teamId=${this.partido.equipoId}`;
      otherMatchesBtn.style.display = 'inline-flex';
    }
    this.renderInfoPartido();
    this.renderQuintetos();
  }

  renderInfoPartido() {
    const container = document.getElementById('infoPartido');
    if (!container) return;

    let html = '';

    // Fecha y Hora
    if (this.partido.fechaHora) {
      const fechaObj = new Date(this.partido.fechaHora);
      const fechaStr = fechaObj.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      const horaStr = fechaObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      html += `<div class="mb-1 fw-bold"><i class="bi bi-calendar-event"></i> ${fechaStr} - ${horaStr}</div>`;
    }

    // Ubicación
    if (this.partido.pabellon) {
      html += `
        <div>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.partido.pabellon)}" 
             target="_blank" class="text-decoration-none text-muted">
            <i class="bi bi-geo-alt-fill"></i> ${this.partido.pabellon}
          </a>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  renderizarEstadisticas() {
    this.matchRenderer.renderEstadisticas('tablaEstadisticasContainer', this.partido);
  }

  renderQuintetos() {
    // Default to 'ataque' if not set
    if (!this.vistaQuinteto) this.vistaQuinteto = 'ataque';
    this.matchRenderer.renderQuintetos('quintetosContainer', this.partido, this.vistaQuinteto);
  }

  cambiarVistaQuinteto(tipo) {
    this.vistaQuinteto = tipo;

    // Update buttons
    const btnAtaque = document.getElementById('btnQuintetoAtaque');
    const btnDefensa = document.getElementById('btnQuintetoDefensa');

    if (tipo === 'ataque') {
      btnAtaque?.classList.add('active');
      btnDefensa?.classList.remove('active');
    } else {
      btnAtaque?.classList.remove('active');
      btnDefensa?.classList.add('active');
    }

    this.renderQuintetos();
  }

  actualizarDisplay() {
    if (this.partido.estado != "finalizado") {
      const periodoSpan = document.getElementById('periodoActual');
      if (periodoSpan) periodoSpan.textContent = this.parteActual || 1;

      const elem = document.getElementById('contador');
      if (elem) {
        const min = Math.floor(this.segundosRestantes / 60);
        const seg = this.segundosRestantes % 60;
        elem.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
      }
    }
  }

  actualizarOrdenMarcador() {
    const containerTimer = document.getElementById('scoreboardTimerContainer');
    const containerTeam = document.getElementById('scoreboardTeamContainer');
    const containerRival = document.getElementById('scoreboardRivalContainer');

    if (!containerTeam || !containerRival) return;

    // Default: esLocal = true -> Team (0), Timer (1), Rival (2)
    const esLocal = (this.partido.esLocal !== false);

    if (containerTimer) containerTimer.style.order = '1';

    if (esLocal) {
      containerTeam.style.order = '0';
      containerRival.style.order = '2';
    } else {
      containerTeam.style.order = '2';
      containerRival.style.order = '0';
    }
  }

  renderParciales() {
    const container = document.getElementById('parcialesCuartos');
    if (!container) return;

    const puntosPorCuarto = {};
    if (this.partido.eventos) {
      Object.values(this.partido.eventos).forEach(ev => {
        if (ev.tipo === 'puntos') {
          if (!puntosPorCuarto[ev.cuarto]) puntosPorCuarto[ev.cuarto] = { equipo: 0, rival: 0 };
          if (!ev.dorsal || ev.dorsal >= 0) puntosPorCuarto[ev.cuarto].equipo += ev.cantidad;
          else puntosPorCuarto[ev.cuarto].rival += ev.cantidad;
        }
      });
    }

    let html = '';
    const quarters = Object.keys(puntosPorCuarto).sort((a, b) => a - b);
    const esLocal = (this.partido.esLocal !== false);

    quarters.forEach(q => {
      // Show all previous quarters
      if (parseInt(q) < (this.parteActual || 1)) {
        const ptsTeam = puntosPorCuarto[q].equipo;
        const ptsRival = puntosPorCuarto[q].rival;
        const str = esLocal ? `${ptsTeam}-${ptsRival}` : `${ptsRival}-${ptsTeam}`;
        html += `<span class="mx-1">Q${q}: ${str}</span>`;
      }
    });

    container.innerHTML = html;
  }
  renderEventosEnVivo() {
    this.matchRenderer.renderEventosEnVivo('listaEventosEnVivo', this.partido);
  }

  iniciarRefrescoSiEnCurso() {
    // Limpia refresco previo si existe
    if (this.refrescoInterval) {
      clearInterval(this.refrescoInterval);
      this.refrescoInterval = null;
    }
    //console.log(this.partido.estado)
    if (this.partido && this.partido.estado != 'finalizado') {
      // Refrescar cada 30 segundos recargando datos desde Supabase
      this.refrescoInterval = setInterval(() => {
        if (this.partido && this.partido.id) {
          this.cargarPartidoGlobal(this.partido.id);
        }
      }, 30000);

    }
  }

  actualizarLucesFaltas() {
    const faltas = this.calcularFaltasCuarto();
    this.renderLuces('foulLightsEquipo', faltas.equipo);
    this.renderLuces('foulLightsRival', faltas.rival);
  }

  calcularFaltasCuarto() {
    let faltasEquipo = 0;
    let faltasRival = 0;
    const cuartoActual = this.parteActual || 1;

    if (this.partido.eventos) {
      Object.values(this.partido.eventos).forEach(evento => {
        if (evento.cuarto === cuartoActual && (evento.tipo === 'faltas' || evento.estadisticaTipo === 'faltas')) {
          if (evento.dorsal >= 0) {
            faltasEquipo++;
          } else {
            faltasRival++;
          }
        }
      });
    }
    return { equipo: faltasEquipo, rival: faltasRival };
  }

  renderLuces(elementId, numFaltas) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const dots = container.querySelectorAll('.foul-dot');
    dots.forEach((dot, index) => {
      if (index < numFaltas) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
}
