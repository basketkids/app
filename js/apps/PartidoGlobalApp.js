class PartidosGlobalesApp {
  constructor(dataService) {
    this.dataService = dataService;
    this.partido = null;
    this.refrescoInterval = null;
    this.segundosRestantes = 0; // Para controlar display tiempo
    this.parteActual = 1;       // Para controlar el cuarto actual
    this.matchRenderer = new MatchRenderer();
    this.teamService = new TeamService(firebase.database());
    this.currentUser = null;

    // Auth listener
    firebase.auth().onAuthStateChanged(user => {
      this.currentUser = user;
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
        this.partido = partido;
        this.partido.id = partidoId;
        // console.log(this.partido.id);


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
        this.mostrarError('No se pudo cargar el partido global.');
      });
  }

  async updateRequestButton() {
    const btn = document.getElementById('requestAccessBtn');
    if (!btn || !this.partido || !this.currentUser) {
      if (btn) btn.style.display = 'none';
      return;
    }

    // Don't show if user is owner
    if (this.currentUser.uid === this.partido.ownerUid) {
      btn.style.display = 'none';
      return;
    }

    // Check if already has permission (e.g. is statistician) - simplified check
    // For now, just check if request exists
    if (!this.partido.ownerUid || !this.partido.equipoId || !this.partido.competicionId) {
      console.warn("Missing data for request check:", this.partido);
      btn.style.display = 'none';
      return;
    }

    const requestRef = firebase.database().ref(`usuarios/${this.partido.ownerUid}/equipos/${this.partido.equipoId}/competiciones/${this.partido.competicionId}/partidos/${this.partido.id}/requests/${this.currentUser.uid}`);

    try {
      const snap = await requestRef.once('value');
      if (snap.exists()) {
        btn.style.display = 'inline-block';
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-clock-history"></i> Solicitud enviada';
        btn.classList.remove('btn-outline-warning');
        btn.classList.add('btn-secondary');
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

    const db = firebase.database();
    const updates = {};

    // Path for the request itself
    const requestPath = `usuarios/${this.partido.ownerUid}/equipos/${this.partido.equipoId}/competiciones/${this.partido.competicionId}/partidos/${this.partido.id}/requests/${this.currentUser.uid}`;
    updates[requestPath] = {
      email: this.currentUser.email,
      displayName: this.currentUser.displayName || 'Usuario',
      photoURL: this.currentUser.photoURL || null, // Add photoURL if available
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      status: 'pending'
    };

    // Add notification for the owner
    const notificationRef = db.ref(`usuarios/${this.partido.ownerUid}/notifications`).push();
    updates[`usuarios/${this.partido.ownerUid}/notifications/${notificationRef.key}`] = {
      type: 'scorer_request',
      teamId: this.partido.equipoId,
      compId: this.partido.competicionId,
      matchId: this.partido.id,
      requesterUid: this.currentUser.uid,
      requesterName: this.currentUser.displayName || 'Usuario',
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      read: false
    };

    try {
      await db.ref().update(updates);
      alert("Solicitud enviada. El propietario debe aprobarla.");
      this.updateRequestButton();
    } catch (e) {
      console.error("Error sending request", e);
      alert("Error al enviar solicitud: " + e.message);
    }
  }

  async updateFollowButton() {
    const followBtn = document.getElementById('followBtn');
    // console.log("updateFollowButton check:", {
    //     btn: !!followBtn,
    //     partido: !!this.partido,
    //     ownerUid: this.partido?.ownerUid,
    //     equipoId: this.partido?.equipoId
    // });

    if (!followBtn || !this.partido || !this.partido.ownerUid || !this.partido.equipoId) {
      if (followBtn && (!this.partido.ownerUid || !this.partido.equipoId)) {
        console.warn("Follow button hidden because ownerUid or equipoId is missing in match data.");
      }
      return;
    }

    followBtn.style.display = 'inline-block';

    if (!this.currentUser) {
      followBtn.innerHTML = '<i class="bi bi-heart"></i> Seguir Equipo';
      followBtn.classList.remove('btn-primary');
      followBtn.classList.add('btn-outline-primary');
      return;
    }

    try {
      const isFollowing = await this.teamService.isFollowing(this.partido.ownerUid, this.partido.equipoId, this.currentUser.uid);
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
    if (!this.partido) return;

    if (!this.currentUser) {
      alert("Debes iniciar sesión para seguir a un equipo.");
      return;
    }

    const followBtn = document.getElementById('followBtn');
    followBtn.disabled = true;

    try {
      const isFollowing = await this.teamService.isFollowing(this.partido.ownerUid, this.partido.equipoId, this.currentUser.uid);
      if (isFollowing) {
        await this.teamService.unfollowTeam(this.partido.ownerUid, this.partido.equipoId, this.currentUser.uid);
      } else {
        await this.teamService.followTeam(this.partido.ownerUid, this.partido.equipoId, this.currentUser.uid);
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
    if (nombreElem) nombreElem.textContent = this.partido.nombreEquipo + " vs " + this.partido.nombreRival;



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

    // Renderizar faltas rival
    // const faltasRival = document.getElementById('faltasRival');
    // if (faltasRival) faltasRival.textContent = `F: ${this.partido.faltasRival || 0}`;

    this.actualizarLucesFaltas();
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
      btnAtaque.classList.add('active');
      btnDefensa.classList.remove('active');
    } else {
      btnAtaque.classList.remove('active');
      btnDefensa.classList.add('active');
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
    // else block removed as hiding header is not desired behavior for finished game with new design
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
      // Refrescar cada 30 segundos recargando datos desde Firebase

      this.refrescoInterval = setInterval(() => {
        this.cargarPartidoGlobal(this.partido.id);
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
        if (evento.cuarto === cuartoActual && evento.estadisticaTipo === 'faltas') {
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
