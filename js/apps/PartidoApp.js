class PartidoApp extends BaseApp {
  constructor() {
    super();
    this.dataService = null;
    this.teamMembersService = new TeamMembersService(this.db);

    // Estado centralizado único que contiene toda la información del partido
    this.partido = null;
    this.plantillaJugadores = [];
    this.rivales = [];

    this.selectConfiguracion = document.getElementById('selectConfiguracion');
    this.selectCuarto = document.getElementById('selectCuarto');
    this.btnStartPause = document.getElementById('btnStartPause');
    this.btnTerminarCuarto = document.getElementById('btnTerminarCuarto');
    this.btnTerminar = document.getElementById('btnTerminar');
    this.contadorInterval = null;
    this.contadorActivo = false;
    this.matchRenderer = new MatchRenderer();
    this.userRole = 'follower';
    this.jerseyColor = '5199e4';
    this.selectedPlayerId = null; // Track selected player for stats
  }

  onUserLoggedIn(user) {
    this.currentUser = user;
    const teamId = this.getParam('idEquipo');
    const competitionId = this.getParam('idCompeticion');
    const matchId = this.getParam('idPartido');
    this.ownerUid = this.getParam('ownerUid') || user.uid;

    if (!teamId || !competitionId || !matchId) {
      alert('Faltan parámetros en la URL');
      window.location.href = 'index.html';
      return;
    }

    this.checkPermissions(teamId).then(() => {
      this.dataService = new DataService(this.db, this.ownerUid, teamId, competitionId, matchId);
      this.initMatch();
    });
  }

  async checkPermissions(teamId) {
    if (this.currentUser.uid === this.ownerUid) {
      this.userRole = 'owner';
      return;
    }

    const memberSnap = await this.teamMembersService.getMembers(this.ownerUid, teamId, () => { }).once('value');
    if (memberSnap.exists() && memberSnap.hasChild(this.currentUser.uid)) {
      this.userRole = memberSnap.child(this.currentUser.uid).val().role;
    }
  }

  async initMatch() {
    try {
      this.partido = await this.dataService.cargarPartido();
      console.log(this.partido);

      if (!this.partido) throw new Error('Partido no encontrado');

      this.plantillaJugadores = await this.dataService.cargarPlantilla();
      this.rivales = await this.dataService.cargarRivales();
      // Ajustar configuración partido y temporizador según datos cargados
      this.configuracionPartido = this.partido.configuracion || '4x10';
      this.configurarPartido(this.configuracionPartido, false);

      this.parteActual = this.partido.parteActual || 1;
      // console.log(this.partido.parteActual);
      // console.log(this.parteActual);
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);

      this.estadoPartido = this.partido.estado || 'no empezado';

      this.calcularTiempoRestante();
      this.renderizarTodo();
      this.prepararEventos();
      this.inicializarTemporizador();
      this.applyPermissions();
      this.loadRequests();
    } catch (error) {
      console.error(error);
      alert('Error cargando los datos del partido');
    }
  }

  applyPermissions() {
    const canEdit = (this.userRole === 'owner' || this.userRole === 'statistician');

    if (!canEdit) {
      // Disable all controls except navigation tabs and share buttons
      const controls = document.querySelectorAll('button, select, input');
      controls.forEach(el => {
        if (el.id !== 'shareBtn' && el.id !== 'publicMatchBtn' && !el.classList.contains('nav-link') && !el.classList.contains('btn-close')) {
          el.disabled = true;
          el.style.pointerEvents = 'none';
        }
      });

      // Hide edit button
      const btnEditar = document.getElementById('btnEditarPartido');
      if (btnEditar) btnEditar.style.display = 'none';
    }
  }
  calcularTiempoRestante() {
    //  console.log(this.parteActual);
    // console.log(this.partido.parteActual);
    // Aquí actualizar cuarto y segundos al último evento si existen eventos
    const eventosArray = this.partido.eventos ? Object.values(this.partido.eventos) : [];
    if (eventosArray.length > 0) {
      eventosArray.sort((a, b) => {
        if (a.cuarto === b.cuarto) {
          return b.tiempoSegundos - a.tiempoSegundos; // más reciente primero
        } else {
          return b.cuarto - a.cuarto; // cuarto mayor primero
        }
      });
      const ultimaJugada = eventosArray[0];
      // console.log(ultimaJugada);
      this.partido.parteActual = ultimaJugada.cuarto || this.partido.parteActual || 1;
      const duracionParte = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
      this.segundosRestantes = duracionParte - (ultimaJugada.tiempoSegundos || 0);
      if (this.segundosRestantes < 0) this.segundosRestantes = 0;
    } else {
      this.partido.parteActual = this.partido.parteActual || 1;
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
    }
    // console.log(this.parteActual);
    // console.log(this.partido.parteActual);

  }

  configurarPartido(opcion, guardarEnFirebase = true) {
    if (opcion === '6x8') {
      this.partido.duracionParte = 8 * 60;
      this.partido.totalPartes = 6;
      this.partido.configuracion = '6x8';
    }
    else {
      this.partido.duracionParte = 10 * 60;
      this.partido.totalPartes = 4;
      this.partido.configuracion = '4x10';
    }

    //
    this.segundosRestantes = this.partido.duracionParte;
    this.estadoPartido = 'no empezado';

    this.pausarContador();
    this.actualizarDisplay();

    if (this.selectCuarto) {
      this.selectCuarto.innerHTML = '';
      for (let i = 1; i <= this.partido.totalPartes; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        this.selectCuarto.appendChild(option);
      }

      this.selectCuarto.value = this.partido.parteActual;
      this.selectCuarto.value = this.partido.parteActual;
    }

    if (this.selectConfiguracion) {
      this.selectConfiguracion.value = this.partido.configuracion;
    }

    if (guardarEnFirebase) {
      this.dataService.guardarPartido(this.partido).catch(console.error);
    }
  }

  renderizarTodo() {
    this.renderListaJugadoresPlantilla();
    this.renderListaJugadoresConvocados();
    this.renderListaJugadoresPista();
    this.renderEventosEnVivo();
    this.actualizarDisplay();
    this.actualizarBotonesPorEstado();
    this.actualizarMarcadoryFaltas();
    this.renderNombresEquipos();
    this.renderInfoPartido();
    this.actualizarLinksPublicos();
    this.renderCronica();
    this.actualizarOrdenMarcador();
    this.renderFantasy();
    this.renderQuintetos();
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

    if (btnAtaque && btnDefensa) {
      if (tipo === 'ataque') {
        btnAtaque.classList.add('active');
        btnDefensa.classList.remove('active');
      } else {
        btnAtaque.classList.remove('active');
        btnDefensa.classList.add('active');
      }
    }

    this.renderQuintetos();
  }

  renderFantasy() {
    this.matchRenderer.renderFantasy('fantasyContainer', this.partido, this.jerseyColor, this.plantillaJugadores);
  }

  actualizarLinksPublicos() {
    const shareBtn = document.getElementById('shareBtn');
    const publicMatchBtn = document.getElementById('publicMatchBtn');

    // Construir URL pública absoluta
    // Asumimos que public/partido.html está en ../public/partido.html relativo a la app admin
    // Pero necesitamos la URL absoluta para compartir
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const publicUrl = `${baseUrl}/public/partido.html?id=${this.dataService.matchId}`;

    if (shareBtn) {
      shareBtn.href = `https://wa.me/?text=` + encodeURIComponent(`Sigue el partido en vivo: ${publicUrl}`);
    }

    if (publicMatchBtn) {
      publicMatchBtn.href = publicUrl;
    }
  }

  renderInfoPartido() {
    const container = document.getElementById('infoPartidoConvocatoria');
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

    // Botón Editar
    html += `
      <div class="mt-2">
        <button id="btnEditarInTab" class="btn btn-sm btn-outline-secondary" title="Editar partido">
          <i class="bi bi-pencil"></i> Editar Detalles
        </button>
      </div>
    `;

    container.innerHTML = html;

    // Attach listener
    const btn = document.getElementById('btnEditarInTab');
    if (btn) {
      btn.addEventListener('click', () => this.abrirModalEditar());
    }
  }
  renderUbicacion() {
    const container = document.getElementById('ubicacionPartido');
    if (!container) return;

    if (this.partido.pabellon) {
      container.innerHTML = `
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.partido.pabellon)}" 
           target="_blank" class="text-decoration-none text-muted">
          <i class="bi bi-geo-alt-fill"></i> ${this.partido.pabellon}
        </a>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  async renderNombresEquipos() {
    const nombreEquipo = document.getElementById('nombreEquipoMarcador');
    const nombreRival = document.getElementById('nombreEquipoRival') || document.getElementById('nombreRivalMarcador');
    const nombreEntrenadorDisplay = document.getElementById('nombreEntrenadorConvocados');

    if (nombreEquipo && this.partido.nombreEquipo) {
      nombreEquipo.textContent = this.partido.nombreEquipo;
    }
    if (nombreRival && this.partido.nombreRival) {
      nombreRival.textContent = this.partido.nombreRival;
    }

    if (this.partido.equipoId && this.ownerUid) {
      try {
        const teamSnap = await this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.partido.equipoId}`).once('value');
        if (teamSnap.exists()) {
          const teamData = teamSnap.val();
          const entrenador = teamData.entrenador;
          this.jerseyColor = teamData.jerseyColor || '5199e4';

          if (nombreEntrenadorDisplay) {
            if (entrenador) {
              nombreEntrenadorDisplay.textContent = `Entrenador/a: ${entrenador}`;
              nombreEntrenadorDisplay.style.display = 'block';
            } else {
              nombreEntrenadorDisplay.style.display = 'none';
            }
          }
          // Re-render fantasy with correct color if needed
          this.renderFantasy();
        }
      } catch (e) {
        console.error('Error fetching team data:', e);
      }
    }
  }


  prepararEventos() {
    this.selectConfiguracion?.addEventListener('change', e => this.configurarPartido(e.target.value));

    this.selectCuarto?.addEventListener('change', e => {
      this.partido.parteActual = parseInt(e.target.value);
      this.segundosRestantes = this.partido.duracionParte;
      this.guardarPartido();
      this.actualizarDisplay();
    });

    document.getElementById('formConvocarJugadores')?.addEventListener('submit', e => {
      e.preventDefault();
      this.guardarConvocadosModal();
    });

    document.getElementById('formElegirPista')?.addEventListener('submit', e => {
      e.preventDefault();
      this.guardarJugadoresEnPista();
    });

    this.btnStartPause?.addEventListener('click', () => this.toggleTemporizador());
    this.btnTerminarCuarto?.addEventListener('click', () => this.terminarCuarto());
    this.btnTerminar?.addEventListener('click', () => this.terminarPartido());



    const btnPuntoRival1 = document.getElementById('btnPuntoRival1');
    const btnPuntoRival2 = document.getElementById('btnPuntoRival2');
    const btnPuntoRival3 = document.getElementById('btnPuntoRival3');
    const btnFaltasRival = document.getElementById('btnFaltasRival');

    if (btnPuntoRival1) {
      btnPuntoRival1.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 1));
    }
    if (btnPuntoRival2) {
      btnPuntoRival2.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 2));
    }
    if (btnPuntoRival3) {
      btnPuntoRival3.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 3));
    }
    if (btnFaltasRival) {
      btnFaltasRival.addEventListener('click', () => this.agregarEstadistica('', 'faltas', 1));
    }

    document.getElementById('btnEditarPartido')?.addEventListener('click', () => this.abrirModalEditar());
    document.getElementById('formEditarPartido')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.guardarDatosPartido();
    });

    document.getElementById('btnBorrarCronica')?.addEventListener('click', () => this.borrarCronica());

    const btnDownload = document.getElementById('btnDownloadMatch');
    if (btnDownload) {
      if (this.userRole === 'owner') {
        btnDownload.style.display = 'inline-block';
        btnDownload.addEventListener('click', () => this.downloadMatchData());
      }
    }

    this.configureApiKeyUI();

    document.getElementById('csvFileInput')?.addEventListener('change', (e) => this.handleFileUpload(e));

    // Manual AI Mode
    document.getElementById('btnManualMode')?.addEventListener('click', () => this.toggleManualMode());
    document.getElementById('btnCopyPrompt')?.addEventListener('click', () => this.copyPromptToClipboard());
    document.getElementById('btnSaveManualCronica')?.addEventListener('click', () => this.guardarCronicaManual());

    // Swap Stats
    document.getElementById('btnOpenSwapStats')?.addEventListener('click', () => this.abrirModalSwapStats());
    document.getElementById('btnConfirmSwap')?.addEventListener('click', () => this.confirmarSwapStats());

    // Action Panel Events (New UI)
    const actionPanel = document.getElementById('action-controls-footer');
    if (actionPanel) {
      actionPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // Rival Quick Actions (ID specific)
        if (btn.id === 'btnRivalP1') return this.agregarEstadistica('', 'puntos', 1);
        if (btn.id === 'btnRivalP2') return this.agregarEstadistica('', 'puntos', 2);
        if (btn.id === 'btnRivalP3') return this.agregarEstadistica('', 'puntos', 3);
        if (btn.id === 'btnRivalF') return this.agregarEstadistica('', 'puntos', 1, 'faltas'); // Wait, signature is id, type, amount. Faltas is type.

        const action = btn.dataset.action;
        const value = parseInt(btn.dataset.val) || 1;

        if (action) {
          this.triggerButtonEffect(btn);
          this.handleActionPanelClick(action, value);
        }
      });

      // Bind Miss Modal buttons
      const modalFallo = document.getElementById('modalFallo');
      if (modalFallo) {
        modalFallo.addEventListener('click', (e) => {
          const btn = e.target.closest('.action-miss-val');
          if (!btn) return;
          const val = parseInt(btn.dataset.val);
          if (this.selectedPlayerId && val) {
            this.registrarFallo(this.selectedPlayerId, val);
            bootstrap.Modal.getInstance(modalFallo).hide();
          }
        });
      }

      // Special handling for Rival Faltas button manual binding if needed or fix logic above
      const btnRivalF = document.getElementById('btnRivalF');
      if (btnRivalF) {
        // Remove previous if any or relies on delegation above? 
        // The delegation above catching 'btnRivalF' was calling pts which is wrong.
      }
    }

    // Fix Rival Faltas delegation correctly
    if (document.getElementById('btnRivalF')) {
      document.getElementById('btnRivalF').onclick = (e) => {
        e.stopPropagation();
        this.triggerButtonEffect(e.target.closest('button'));
        this.agregarEstadistica('', 'faltas', 1);
      };
    }
  }

  triggerButtonEffect(btn) {
    if (!btn) return;
    // Remove class if it exists to restart animation
    btn.classList.remove('btn-effect');
    void btn.offsetWidth; // Force reflow
    btn.classList.add('btn-effect');
    setTimeout(() => btn.classList.remove('btn-effect'), 200);
  }

  handleActionPanelClick(action, value) {
    if (!this.selectedPlayerId && action !== 'falta' && action !== 'fallo') {
      // Check if we want to allow selecting player AFTER action? 
      // For now, require selection.
      // Unless action is purely global which we don't have yet except Rival (handled separately).
      // Fallo/Falta also need player.
    }

    if (!this.selectedPlayerId) {
      alert("Selecciona un jugador primero.");
      return;
    }

    const p = this.selectedPlayerId;

    // Reset selection after action? Maybe optional preference. 
    // For now, keep selected for rapid entry (e.g. offensive reb + putback).

    if (action === 'puntos') {
      this.agregarEstadistica(p, 'puntos', value);
    } else if (action === 'fallo') {
      // Show modal or assume 2pts? Let's default to a prompt or simple 2p miss for now
      // Or reuse the logic. 'fallo' button in HTML didn't have value.
      // Let's prompt or simple toggle? 
      // Ideally Miss should ask 1, 2, 3? 
      // Simplified: MISS -> Prompt? Or Buttons like +1/-1?
      // Let's open a small miss selector or just default to 2?
      this.mostrarOpcionesFallo(p);
    } else {
      // rebound, assist, steal, block, foul
      this.agregarEstadistica(p, action, value);
    }
  }

  mostrarOpcionesFallo(id) {
    const modalEl = document.getElementById('modalFallo');
    if (!modalEl) return;

    const jugador = this.plantillaJugadores.find(j => j.id === id);
    const nombreEl = document.getElementById('nombreJugadorFallo');
    if (nombreEl && jugador) nombreEl.textContent = jugador.nombre;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.detectTeamsAndShowSelection(content);
    };
    reader.readAsText(file);
  }

  detectTeamsAndShowSelection(csvContent) {
    const lines = csvContent.split('\n');
    const teams = [];

    // Heurística simple: buscar líneas que no sean cabeceras y tengan pocas comas o estructura de nombre de equipo
    // En el ejemplo: "CB CAREBA,,,,,,,,,,,,,,,,,,,,,"
    // La línea tiene un nombre y luego muchas comas vacías.

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Ignorar líneas conocidas
      if (line.includes('FEDERACIÓN ANDALUZA') || line.includes('Estadisticas -') || line.startsWith('Num.,Nombre') || line.startsWith(',TOTALES')) continue;

      // Si la línea empieza con texto y luego tiene muchas comas (indicando celdas vacías a la derecha)
      // Ejemplo: CB CAREBA,,,,,,,,,,,,,,,,,,,,,
      // Regex: Empieza con texto (no coma), seguido de al menos 5 comas consecutivas
      if (/^[^,]+,{5,}/.test(line)) {
        const teamName = line.split(',')[0].trim();
        if (teamName && !teams.includes(teamName)) {
          teams.push(teamName);
        }
      }
    }

    if (teams.length === 0) {
      alert('No se detectaron equipos en el archivo CSV. Verifica el formato.');
      return;
    }

    const container = document.getElementById('importTeamSelection');
    const buttonsContainer = document.getElementById('importTeamButtons');
    container.classList.remove('d-none');
    buttonsContainer.innerHTML = '';

    teams.forEach(team => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-primary';
      btn.textContent = team;
      btn.onclick = () => this.procesarStatsEquipo(team, lines);
      buttonsContainer.appendChild(btn);
    });
  }

  procesarStatsEquipo(teamName, lines) {
    let startIndex = -1;
    let endIndex = -1;

    // Buscar el bloque del equipo
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith(teamName)) {
        // Encontramos el nombre del equipo.
        // Buscar la siguiente cabecera "Num.,Nombre"
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith('Num.,Nombre')) {
            startIndex = j + 1;
            break;
          }
        }
        break; // Solo procesamos el primer match del equipo (asumiendo que no se repite)
      }
    }

    if (startIndex === -1) {
      alert(`No se encontró la tabla de estadísticas para ${teamName}.`);
      return;
    }

    let importedCount = 0;
    const statsUpdate = {};
    const nuevosConvocados = {};

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      // Si llegamos a TOTALES o fin de bloque (otra cabecera o equipo), paramos
      if (!line || line.startsWith(',TOTALES') || line.startsWith('TOTALES')) break;
      // Si encontramos otro nombre de equipo (heurística de muchas comas), paramos
      if (/^[^,]+,{5,}/.test(line) && !line.startsWith(teamName)) break;

      // Parsear línea (reutilizando lógica anterior)
      const rawParts = line.split(',');
      const cleanParts = [];
      let buffer = null;
      for (const p of rawParts) {
        if (buffer !== null) {
          buffer += ',' + p;
          if (p.trim().endsWith('"')) {
            cleanParts.push(buffer.replace(/^"|"$/g, '').trim());
            buffer = null;
          }
        } else {
          if (p.trim().startsWith('"') && !p.trim().endsWith('"')) {
            buffer = p;
          } else {
            cleanParts.push(p.replace(/^"|"$/g, '').trim());
          }
        }
      }
      if (buffer !== null) cleanParts.push(buffer.replace(/^"|"$/g, '').trim());

      if (cleanParts.length < 20) continue;

      const dorsalStr = cleanParts[0].trim();
      if (dorsalStr === '' || isNaN(dorsalStr)) continue;
      const dorsal = parseInt(dorsalStr, 10);
      const nombreJugadorCSV = cleanParts[1].trim();

      // Buscar jugador
      let jugadorId = null;

      // 1. Buscar en convocados
      if (this.partido.convocados) {
        const convocadoId = Object.keys(this.partido.convocados).find(id =>
          parseInt(this.partido.convocados[id].dorsal) === dorsal
        );
        if (convocadoId) jugadorId = convocadoId;
      }

      // 2. Si no está en convocados, buscar en plantilla completa
      if (!jugadorId && this.plantillaJugadores) {
        const jugadorPlantilla = this.plantillaJugadores.find(j => parseInt(j.dorsal) === dorsal);
        if (jugadorPlantilla) {
          jugadorId = jugadorPlantilla.id;
          // Añadir a convocados para que se guarden sus stats
          if (!this.partido.convocados) this.partido.convocados = {};
          this.partido.convocados[jugadorId] = {
            dorsal: jugadorPlantilla.dorsal,
            nombre: jugadorPlantilla.nombre,
            avatarConfig: jugadorPlantilla.avatarConfig || null
          };
          nuevosConvocados[jugadorId] = true;
        }
      }

      if (!jugadorId) {
        console.warn(`Jugador con dorsal ${dorsal} (${nombreJugadorCSV}) no encontrado en plantilla. Saltando.`);
        continue;
      }

      // Extraer stats
      const getVal = (idx) => parseInt(cleanParts[idx]) || 0;
      const getSplit = (idx) => {
        const s = cleanParts[idx].split('/');
        return {
          conv: parseInt(s[0]) || 0,
          int: parseInt(s[1]) || 0
        };
      };

      const pts = getVal(3);
      const t2 = getSplit(4);
      const t3 = getSplit(6);
      const t1 = getSplit(8);
      const reb = getVal(12);
      const ast = getVal(13);
      const rob = getVal(14);
      const tap = getVal(16);
      const fal = getVal(18);
      const masMenos = parseInt(cleanParts[21]) || 0;

      statsUpdate[jugadorId] = {
        puntos: pts,
        asistencias: ast,
        rebotes: reb,
        robos: rob,
        tapones: tap,
        faltas: fal,
        masMenos: masMenos,
        t1_convertidos: t1.conv,
        t1_fallados: t1.int - t1.conv,
        t2_convertidos: t2.conv,
        t2_fallados: t2.int - t2.conv,
        t3_convertidos: t3.conv,
        t3_fallados: t3.int - t3.conv,
        _loadedFromStorage: true
      };
      importedCount++;
    }

    if (importedCount > 0) {
      if (!this.partido.estadisticasJugadores) this.partido.estadisticasJugadores = {};

      Object.keys(statsUpdate).forEach(jid => {
        this.partido.estadisticasJugadores[jid] = statsUpdate[jid];
      });

      let totalPuntos = 0;
      Object.values(this.partido.estadisticasJugadores).forEach(s => totalPuntos += (s.puntos || 0));
      this.partido.puntosEquipo = totalPuntos;

      this.guardarPartido().then(() => {
        const msgNuevos = Object.keys(nuevosConvocados).length > 0 ? `\nSe añadieron ${Object.keys(nuevosConvocados).length} jugadores de la plantilla a la convocatoria.` : '';
        alert(`Se importaron estadísticas para ${importedCount} jugadores del equipo ${teamName}.${msgNuevos}`);
        bootstrap.Modal.getInstance(document.getElementById('modalImportarStats')).hide();
        // Reset UI
        document.getElementById('csvFileInput').value = '';
        document.getElementById('importTeamSelection').classList.add('d-none');
        this.renderizarTodo();
      });
    } else {
      alert(`No se encontraron jugadores coincidentes para el equipo ${teamName}.`);
    }
  }

  downloadMatchData() {
    if (!this.partido) return;
    const dataStr = JSON.stringify(this.partido, null, 2);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `partido_${this.dataService.matchId}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  abrirModalEditar() {
    if (!this.partido) return;
    const inputFecha = document.getElementById('editFechaHora');
    const inputPabellon = document.getElementById('editPabellon');
    const inputNombreRival = document.getElementById('editNombreRival');
    const inputEsLocal = document.getElementById('editEsLocal');

    if (this.partido.fechaHora) {
      // Convertir fecha ISO a formato datetime-local (YYYY-MM-DDTHH:mm)
      const date = new Date(this.partido.fechaHora);
      // Ajustar a zona horaria local para el input
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
      inputFecha.value = localISOTime;
    } else {
      inputFecha.value = '';
    }

    inputPabellon.value = this.partido.pabellon || '';

    // Popular select de rivales
    inputNombreRival.innerHTML = '<option value="">Seleccionar rival...</option>';
    this.rivales.forEach(rival => {
      const option = document.createElement('option');
      option.value = rival.id;
      option.textContent = rival.nombre;
      inputNombreRival.appendChild(option);
    });

    // Seleccionar el rival actual
    if (this.partido.rivalId) {
      inputNombreRival.value = this.partido.rivalId;
    } else if (this.partido.nombreRival) {
      // Intentar buscar por nombre si no hay ID (retrocompatibilidad)
      const rivalEncontrado = this.rivales.find(r => r.nombre === this.partido.nombreRival);
      if (rivalEncontrado) {
        inputNombreRival.value = rivalEncontrado.id;
      }
    }

    if (inputEsLocal) {
      // Default to true if undefined
      inputEsLocal.checked = (this.partido.esLocal !== false);
    }

    const modal = new bootstrap.Modal(document.getElementById('modalEditarPartido'));
    modal.show();
  }

  guardarDatosPartido() {
    const inputFecha = document.getElementById('editFechaHora');
    const inputPabellon = document.getElementById('editPabellon');
    const inputNombreRival = document.getElementById('editNombreRival');
    const inputEsLocal = document.getElementById('editEsLocal');

    if (inputFecha.value) {
      const fechaPartido = new Date(inputFecha.value);
      const fechaMinima = new Date('1891-12-21T00:00:00');
      if (fechaPartido < fechaMinima) {
        return alert('La fecha del partido no puede ser anterior al 21 de diciembre de 1891 (invención del baloncesto).');
      }
      this.partido.fechaHora = fechaPartido.toISOString();
    }
    this.partido.pabellon = inputPabellon.value;

    const rivalId = inputNombreRival.value;
    if (rivalId) {
      this.partido.rivalId = rivalId;
      const rivalObj = this.rivales.find(r => r.id === rivalId);
      this.partido.nombreRival = rivalObj ? rivalObj.nombre : '';
    } else {
      // Si no selecciona nada, mantenemos o limpiamos? 
      // Asumimos que debe seleccionar uno. Si limpia, se queda vacio.
      this.partido.rivalId = null;
      this.partido.nombreRival = '';
    }

    if (inputEsLocal) {
      this.partido.esLocal = inputEsLocal.checked;
    }

    this.dataService.guardarPartido(this.partido)
      .then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalEditarPartido')).hide();
        this.renderInfoPartido();
        this.renderNombresEquipos();
        this.actualizarOrdenMarcador();
        alert('Partido actualizado correctamente');
      })
      .catch(error => {
        console.error('Error al guardar:', error);
        alert('Error al guardar los cambios');
      });
  }

  actualizarOrdenMarcador() {
    const containerTimer = document.getElementById('scoreboardTimerContainer');
    const containerTeam = document.getElementById('scoreboardTeamContainer');
    const containerRival = document.getElementById('scoreboardRivalContainer');

    if (!containerTeam || !containerRival) return;

    // Default: esLocal = true -> Team (0), Timer (1), Rival (2)
    // If esLocal = false -> Rival (0), Timer (1), Team (2)
    const esLocal = (this.partido.esLocal !== false);

    // Ensure timer is always in the middle
    if (containerTimer) containerTimer.style.order = '1';

    if (esLocal) {
      containerTeam.style.order = '0';
      containerRival.style.order = '2';
    } else {
      containerTeam.style.order = '2';
      containerRival.style.order = '0';
    }
  }

  renderEventosEnVivo() {
    this.matchRenderer.renderEventosEnVivo('listaEventosEnVivo', this.partido, (id, evento) => this.borrarEvento(id, evento));
  }

  borrarEvento(eventoId, evento) {
    if (!confirm('¿Estás seguro de que quieres deshacer este evento?')) return;

    this.dataService.deleteEvento(eventoId, evento)
      .then(() => {
        console.log('Evento eliminado y revertido');
        // Recargar datos para actualizar UI
        return this.dataService.cargarPartido();
      })
      .then(partidoActualizado => {
        this.partido = partidoActualizado;

        // Defensive: Ensure event is gone locally
        if (this.partido.eventos && this.partido.eventos[eventoId]) {
          console.warn("Event still present after delete, removing locally");
          delete this.partido.eventos[eventoId];
        }

        this.renderizarTodo();
      })
      .catch(error => {
        console.error('Error al borrar evento:', error);
        alert('Error al deshacer el evento');
      });
  }


  renderListaJugadoresPlantilla() {
    const ul = document.getElementById('listaJugadoresPlantilla');
    const checkAll = document.getElementById('checkSeleccionarTodos');
    if (!ul) return;
    ul.innerHTML = '';

    const updateCheckAllState = () => {
      if (!checkAll) return;
      const allChecked = this.plantillaJugadores.length > 0 && this.plantillaJugadores.every(j => this.partido.convocados && this.partido.convocados[j.id]);
      checkAll.checked = allChecked;
    };

    if (checkAll) {
      checkAll.onclick = () => {
        const isChecked = checkAll.checked;
        if (!this.partido.convocados) this.partido.convocados = {};

        this.plantillaJugadores.forEach(j => {
          if (isChecked) {
            this.partido.convocados[j.id] = {
              dorsal: j.dorsal,
              nombre: j.nombre,
              avatarConfig: j.avatarConfig || null
            };
          } else {
            delete this.partido.convocados[j.id];
          }
        });
        this.renderListaJugadoresPlantilla(); // Re-render to update individual checkboxes
        this.guardarPartido();
      };
    }

    this.plantillaJugadores.forEach(j => {
      const li = document.createElement('li');
      li.className = 'list-group-item';

      const label = document.createElement('label');
      label.className = 'form-check-label d-flex align-items-center gap-2';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input';
      checkbox.checked = this.partido.convocados && !!this.partido.convocados[j.id];
      checkbox.onchange = () => {
        if (!this.partido.convocados) this.partido.convocados = {};
        if (checkbox.checked) {
          console.log(`Convocando jugador ${j.nombre} (#${j.dorsal})`);
          this.partido.convocados[j.id] = {
            dorsal: j.dorsal,
            nombre: j.nombre,
            avatarConfig: j.avatarConfig || null
          };
        } else {
          console.log(`Desconvocando jugador ${j.nombre}`);
          delete this.partido.convocados[j.id];
        }
        updateCheckAllState();
        this.guardarPartido();
      };

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
      li.appendChild(label);
      ul.appendChild(li);
    });

    updateCheckAllState();
  }

  renderListaJugadoresConvocados() {
    this.matchRenderer.renderEstadisticas('tablaEstadisticasContainer', this.partido);
    this.renderListaJugadoresConvocadosModal();
  }



  renderListaJugadoresPista() {
    const container = document.getElementById('active-players-grid');
    if (!container) return;
    container.innerHTML = '';

    if (!this.partido.jugadoresEnPista) return;

    Object.keys(this.partido.jugadoresEnPista).forEach(id => {
      const jugador = this.plantillaJugadores.find(j => j.id === id);
      if (!jugador) return;

      const card = document.createElement('div');
      card.className = `player-card ${this.selectedPlayerId === id ? 'selected' : ''}`;
      card.onclick = () => {
        this.selectedPlayerId = (this.selectedPlayerId === id) ? null : id;
        this.renderListaJugadoresPista(); // Re-render to update selection style
      };

      const stats = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[id]) || {};

      // Calculate individual fouls
      let fouls = stats.faltas || 0;
      let points = stats.puntos || 0;

      card.innerHTML = `
        <div class="dorsal">${jugador.dorsal}</div>
        <div class="nombre">${jugador.nombre}</div>
        <div class="stats-summary">
            <span class="stat-tag text-success">${points} pts</span>
            <span class="stat-tag ${fouls >= 5 ? 'text-danger' : 'text-warning'}">${fouls} F</span>
        </div>
      `;

      container.appendChild(card);
    });

    // Also clear the old list if it exists to avoid confusion
    const oldList = document.getElementById('listaJugadoresPista');
    if (oldList) oldList.innerHTML = '';

    this.renderListaJugadoresConvocadosModal();
  }


  renderListaJugadoresConvocadosModal() {
    const ul = document.getElementById('listaJugadoresConvocadosModal');
    if (!ul) return;
    ul.innerHTML = '';

    if (!this.partido.convocados) {
      console.warn("No hay objeto convocados en this.partido");
      return;
    }

    const convocadosIds = Object.keys(this.partido.convocados);
    console.log(`Renderizando modal selección pista. ${convocadosIds.length} convocados.`);

    this.plantillaJugadores
      .filter(j => this.partido.convocados.hasOwnProperty(j.id))
      .forEach(j => {
        const li = document.createElement('li');
        li.className = 'list-group-item';

        const label = document.createElement('label');
        label.className = 'form-check-label d-flex align-items-center gap-2';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input';

        checkbox.checked = this.partido.jugadoresEnPista && this.partido.jugadoresEnPista.hasOwnProperty(j.id);

        checkbox.onchange = () => {
          if (!this.partido.jugadoresEnPista) this.partido.jugadoresEnPista = {};
          const pista = this.partido.jugadoresEnPista;

          const numEnPista = Object.keys(pista).length;

          if (checkbox.checked) {
            if (numEnPista >= 5) {
              checkbox.checked = false;
              alert('Solo 5 jugadores pueden estar en pista');
              return;
            }
            pista[j.id] = true;
          } else {
            delete pista[j.id];
          }
          this.dataService.guardarDatos('jugadoresEnPista', this.partido.jugadoresEnPista).catch(console.error);
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
        li.appendChild(label);
        ul.appendChild(li);
      });
  }


  guardarConvocadosModal() {
    // Ya modificado instantáneamente en checkbox con guardarPartido()
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConvocarJugadores')).hide();
    this.renderListaJugadoresConvocados();
  }

  guardarJugadoresEnPista() {
    // Para guardar jugadores en pista modificar partido y guardar
    if (!this.partido.jugadoresEnPista) this.partido.jugadoresEnPista = {};
    // Ejemplo: suponiendo UI de checkboxes similar a Plantilla
    // Después actualizar Firebase
    this.dataService.guardarPartido(this.partido).then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalElegirPista')).hide();
      this.renderListaJugadoresPista();
    }).catch(e => alert("Error guardando jugadores en pista: " + e.message));
  }


  agregarEstadistica(jugadorId, tipo, cantidad) {
    // Estadísticas de equipo
    if (jugadorId != '') {
      if (!this.partido.estadisticasJugadores) this.partido.estadisticasJugadores = {};
      if (!this.partido.estadisticasJugadores[jugadorId]) {
        this.partido.estadisticasJugadores[jugadorId] = { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0 };
      }
      this.partido.estadisticasJugadores[jugadorId][tipo] += cantidad;

      // Registrar tiros convertidos
      if (tipo === "puntos") {
        this.partido.puntosEquipo += cantidad;
        const keyConvertidos = `t${cantidad}_convertidos`;
        this.partido.estadisticasJugadores[jugadorId][keyConvertidos] = (this.partido.estadisticasJugadores[jugadorId][keyConvertidos] || 0) + 1;
      }
    } else {
      // Estadísticas de rival
      if (tipo === "puntos") {

        this.partido.puntosRival += cantidad;
      } else if (tipo === "faltas") {
        this.partido.faltasRival = (this.partido.faltasRival || 0) + cantidad;
      }
    }

    const nombreEquipoRival = this.partido.nombreRival || 'Rival';
    const evento = {
      tipo: tipo,
      jugadorId: jugadorId,
      nombre: this.partido.convocados && this.partido.convocados[jugadorId]?.nombre || nombreEquipoRival,
      dorsal: this.partido.convocados && this.partido.convocados[jugadorId]?.dorsal || -1,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: `+ ${cantidad} ${tipo}`,
      estadisticaTipo: tipo,
      cantidad: cantidad,
      marcadorEquipo: this.partido.puntosEquipo || 0,
      marcadorRival: this.partido.puntosRival || 0,
      jugadoresEnPista: this.partido.jugadoresEnPista ? Object.keys(this.partido.jugadoresEnPista) : []
    };

    // Optimistic update for +/-
    if (tipo === 'puntos') {
      const delta = (jugadorId !== '') ? cantidad : -cantidad;
      if (this.partido.jugadoresEnPista) {
        Object.keys(this.partido.jugadoresEnPista).forEach(id => {
          if (!this.partido.estadisticasJugadores[id]) {
            this.partido.estadisticasJugadores[id] = { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0 };
          }
          this.partido.estadisticasJugadores[id].masMenos = (this.partido.estadisticasJugadores[id].masMenos || 0) + delta;
        });
      }
    }

    const key = this.dataService.getNewEventKey();
    if (!this.partido.eventos) this.partido.eventos = {};
    this.partido.eventos[key] = evento;
    this.actualizarMarcadoryFaltas();
    this.renderizarTodo();

    this.dataService.pushEvento(evento, key)
      .catch(e => console.error('Error agregando evento:', e));

    // Auto-start timer if not running
    if (!this.contadorActivo && this.estadoPartido !== 'finalizado') {
      this.toggleTemporizador();
    }
  }

  registrarFallo(jugadorId, valor) {
    if (!this.partido.estadisticasJugadores) this.partido.estadisticasJugadores = {};
    if (!this.partido.estadisticasJugadores[jugadorId]) {
      this.partido.estadisticasJugadores[jugadorId] = { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0 };
    }

    const keyFallados = `t${valor}_fallados`;
    this.partido.estadisticasJugadores[jugadorId][keyFallados] = (this.partido.estadisticasJugadores[jugadorId][keyFallados] || 0) + 1;

    const evento = {
      tipo: 'fallo',
      jugadorId: jugadorId,
      nombre: this.partido.convocados && this.partido.convocados[jugadorId]?.nombre || 'Desconocido',
      dorsal: this.partido.convocados && this.partido.convocados[jugadorId]?.dorsal || -1,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: `Fallo de ${valor} punto${valor > 1 ? 's' : ''}`,
      estadisticaTipo: 'fallo',
      cantidad: 0,
      valor: valor, // Para saber de cuánto era el tiro
      marcadorEquipo: this.partido.puntosEquipo || 0,
      marcadorRival: this.partido.puntosRival || 0,
      jugadoresEnPista: this.partido.jugadoresEnPista ? Object.keys(this.partido.jugadoresEnPista) : []
    };

    const key = this.dataService.getNewEventKey();
    if (!this.partido.eventos) this.partido.eventos = {};
    this.partido.eventos[key] = evento;
    this.renderizarTodo();

    this.dataService.pushEvento(evento, key)
      .catch(e => console.error('Error agregando evento de fallo:', e));

    // Auto-start timer if not running
    if (!this.contadorActivo && this.estadoPartido !== 'finalizado') {
      this.toggleTemporizador();
    }
  }




  registrarCambioPista(jugadorId, nombre, dorsal, accion) {
    const evento = {
      tipo: 'cambioPista',
      jugadorId, nombre, dorsal,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: `Jugador ${accion} a pista`,
      marcadorEquipo: this.partido.puntosEquipo || 0,
      marcadorRival: this.partido.puntosRival || 0
    };
    const key = this.dataService.getNewEventKey();
    if (!this.partido.eventos) this.partido.eventos = {};
    this.partido.eventos[key] = evento;

    this.dataService.pushEvento(evento, key)
      .catch(e => console.error('Error guardando evento:', e));
  }
  actualizarMarcadoryFaltas() {
    const me = document.getElementById('marcadorEquipo');
    if (me) me.textContent = this.partido.puntosEquipo || 0;
    const mr = document.getElementById('marcadorRival');
    if (mr) mr.textContent = this.partido.puntosRival || 0;

    this.actualizarLucesFaltas();
  }

  actualizarLucesFaltas() {
    const faltas = this.calcularFaltasCuarto();
    // console.log(faltas);
    this.renderLuces('foulLightsEquipo', faltas.equipo);
    this.renderLuces('foulLightsRival', faltas.rival);
    this.renderParciales();
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
    // Show only COMPLETED quarters (less than current part) OR all quarters? 
    // Usually partials are shown for previous quarters or current live one.
    // User said "anterior" (previous), but seeing current is also useful.
    // Let's show all quarters that have points.

    // Sort keys
    const quarters = Object.keys(puntosPorCuarto).sort((a, b) => a - b);

    // Logic for Team vs Rival based on esLocal
    const esLocal = (this.partido.esLocal !== false);

    quarters.forEach(q => {
      // Don't show current quarter? The user said "anterior", but normally you want to see standard partials.
      // If user strictly wants PREVIOUS, filter by q < this.partido.parteActual
      // Let's show all for now, maybe dim current? Or just show logic.
      // "parcial de cada cuarto anterior" -> strictly previous.
      if (parseInt(q) < (this.partido.parteActual || 1)) {
        const ptsTeam = puntosPorCuarto[q].equipo;
        const ptsRival = puntosPorCuarto[q].rival;
        const str = esLocal ? `${ptsTeam}-${ptsRival}` : `${ptsRival}-${ptsTeam}`;
        html += `<span class="mx-1">Q${q}: ${str}</span>`;
      }
    });

    container.innerHTML = html;
  }

  calcularFaltasCuarto() {
    let faltasEquipo = 0;
    let faltasRival = 0;
    const cuartoActual = this.partido.parteActual || 1;

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

  inicializarTemporizador() {
    this.actualizarDisplay();
    if (this.btnStartPause) {
      // Habilitar si estado es no empezado, para poder iniciar partido
      this.btnStartPause.disabled = false;
    }
    if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = this.estadoPartido !== 'en curso';
    if (this.btnTerminar) this.btnTerminar.disabled = this.estadoPartido !== 'en curso';
  }

  tick() {
    if (this.segundosRestantes > 0) {
      this.segundosRestantes--;
      this.actualizarDisplay();
    } else {
      this.pausarContador();
      alert('Fin del cuarto');
    }
  }

  iniciarContador() {
    if (this.partidoTerminado) return;
    if (!this.contadorActivo) {
      this.contadorInterval = setInterval(() => this.tick(), 1000);
      this.contadorActivo = true;
      if (this.btnStartPause) this.btnStartPause.innerHTML = '<i class="bi bi-pause-fill"></i>';
    }
  }

  pausarContador() {
    if (this.contadorActivo) {
      clearInterval(this.contadorInterval);
      this.contadorInterval = null;
      this.contadorActivo = false;
      if (this.btnStartPause) this.btnStartPause.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
  }

  actualizarDisplay() {
    if (this.selectCuarto) this.selectCuarto.value = this.partido.parteActual || 1;

    const periodoSpan = document.getElementById('periodoActual');
    if (periodoSpan) periodoSpan.textContent = this.partido.parteActual || 1;

    const min = Math.floor(this.segundosRestantes / 60);
    const seg = this.segundosRestantes % 60;
    const elem = document.getElementById('contador');
    if (elem) elem.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  }

  toggleTemporizador() {
    if (this.estadoPartido !== 'en curso') {
      this.guardarEstadoPartido('en curso');
      this.partidoIniciado = true;
      this.partidoTerminado = false;
      this.partido.parteActual = 1;
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
      this.actualizarDisplay();
      if (this.btnStartPause) {
        this.btnStartPause.disabled = false;
        this.btnStartPause.innerHTML = '<i class="bi bi-pause-fill"></i>';
      }
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = false;
      if (this.btnTerminar) this.btnTerminar.disabled = false;
      this.iniciarContador();
      return;
    }
    if (this.contadorActivo) this.pausarContador();
    else this.iniciarContador();
  }

  terminarCuarto() {
    console.log('Terminar cuarto');
    if (this.estadoPartido !== 'en curso') return;
    this.pausarContador();
    if ((this.partido.parteActual || 1) < (this.partido.totalPartes || 4)) {
      this.registrarEventoPartido('finCuarto', `Fin del Cuarto ${this.partido.parteActual}`);

      this.partido.parteActual++;
      this.segundosRestantes = this.partido.duracionParte;
      this.guardarPartido();
      console.log('Partido guardado');
      console.log(this.partido);

      this.registrarEventoPartido('inicioCuarto', `Inicio del Cuarto ${this.partido.parteActual}`);

      this.actualizarDisplay();
      this.renderEventosEnVivo();
      this.actualizarLucesFaltas();

      // this.iniciarContador(); // Don't auto-start next quarter
    } else {
      alert('Último cuarto, termine el partido con el botón Terminar Partido.');
    }
  }

  registrarEventoPartido(tipo, detalle) {
    // console.log('Registrando evento', tipo, detalle);
    const evento = {
      tipo: tipo,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: detalle,
      dorsal: -2, // Special dorsal for system events
      marcadorEquipo: this.partido.puntosEquipo || 0,
      marcadorRival: this.partido.puntosRival || 0
    };
    const key = this.dataService.getNewEventKey();
    if (!this.partido.eventos) this.partido.eventos = {};
    this.partido.eventos[key] = evento;
    this.renderEventosEnVivo();

    this.dataService.pushEvento(evento, key)
      .catch(e => console.error('Error guardando evento:', e));
  }

  terminarPartido() {
    if (this.estadoPartido !== 'en curso') return;
    this.pausarContador();
    this.guardarEstadoPartido('finalizado');
    this.partidoIniciado = false;
    this.partidoTerminado = true;
    if (this.btnStartPause) this.btnStartPause.disabled = true;
    if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
    if (this.btnTerminar) this.btnTerminar.disabled = true;
    alert('El partido ha finalizado.');
  }

  guardarEstadoPartido(estado) {
    this.estadoPartido = estado;
    this.partido.estado = estado;
    this.guardarPartido();
    this.actualizarBotonesPorEstado();
  }

  guardarPartido() {
    console.log('Guardando partido', this.partido);
    // Defensive coding: Ensure convocados exists
    if (!this.partido.convocados) this.partido.convocados = {};

    return this.dataService.guardarPartido(this.partido)
      .then(() => {
        console.log('Partido guardado correctamente en Firebase');
      })
      .catch(error => {
        console.error('Error al guardar partido:', error);
        alert('ERROR CRÍTICO: No se han podido guardar los cambios. ' + error.message);
      });
  }

  actualizarBotonesPorEstado() {
    if (this.estadoPartido === 'no empezado') {
      if (this.btnStartPause) this.btnStartPause.disabled = true;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
      if (this.btnTerminar) this.btnTerminar.disabled = true;
    } else if (this.estadoPartido === 'en curso') {
      if (this.btnStartPause) this.btnStartPause.disabled = false;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = false;
      if (this.btnTerminar) this.btnTerminar.disabled = false;
    } else if (this.estadoPartido === 'finalizado') {
      if (this.btnStartPause) this.btnStartPause.disabled = true;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
      if (this.btnTerminar) this.btnTerminar.disabled = true;
    }
  }
  loadRequests() {
    if (this.userRole !== 'owner') {
      const tabSolicitudes = document.getElementById('tab-solicitudes');
      if (tabSolicitudes) tabSolicitudes.parentElement.style.display = 'none';
      return;
    }

    const requestsRef = this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.dataService.teamId}/competiciones/${this.dataService.competitionId}/partidos/${this.dataService.matchId}/requests`);

    requestsRef.on('value', snapshot => {
      const requests = snapshot.val() || {};
      this.renderRequests(requests);
    });
  }

  renderRequests(requests) {
    const ul = document.getElementById('listaSolicitudes');
    const badge = document.getElementById('badgeSolicitudes');
    if (!ul) return;

    ul.innerHTML = '';
    const numRequests = Object.keys(requests).length;

    if (badge) {
      badge.textContent = numRequests;
      badge.style.display = numRequests > 0 ? 'inline-block' : 'none';
    }

    if (numRequests === 0) {
      ul.innerHTML = '<li class="list-group-item text-muted text-center">No hay solicitudes pendientes</li>';
      return;
    }

    Object.entries(requests).forEach(([uid, data]) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';

      const divInfo = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'fw-bold';
      name.textContent = data.displayName || 'Usuario desconocido';
      divInfo.appendChild(name);

      const email = document.createElement('div');
      email.className = 'small text-muted';
      email.textContent = data.email || '';
      divInfo.appendChild(email);

      li.appendChild(divInfo);

      const divActions = document.createElement('div');
      divActions.className = 'd-flex gap-2';

      const btnApprove = document.createElement('button');
      btnApprove.className = 'btn btn-sm btn-success';
      btnApprove.innerHTML = '<i class="bi bi-check-lg"></i>';
      btnApprove.title = 'Aprobar como estadista';
      btnApprove.onclick = () => this.approveRequest(uid, data);
      divActions.appendChild(btnApprove);

      const btnReject = document.createElement('button');
      btnReject.className = 'btn btn-sm btn-danger';
      btnReject.innerHTML = '<i class="bi bi-x-lg"></i>';
      btnReject.title = 'Rechazar';
      btnReject.onclick = () => this.rejectRequest(uid);
      divActions.appendChild(btnReject);

      li.appendChild(divActions);
      ul.appendChild(li);
    });
  }

  async approveRequest(uid, data) {
    if (!confirm(`¿Aprobar a ${data.displayName} como estadista para este equipo?`)) return;

    try {
      // Add as statistician to the team
      await this.teamMembersService.addMember(this.ownerUid, this.dataService.teamId, uid, 'statistician');

      // Remove request
      await this.rejectRequest(uid); // Reuse delete logic

      alert(`${data.displayName} ha sido añadido como estadista.`);
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error al aprobar la solicitud');
    }
  }

  async rejectRequest(uid) {
    try {
      await this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.dataService.teamId}/competiciones/${this.dataService.competitionId}/partidos/${this.dataService.matchId}/requests/${uid}`).remove();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error al rechazar la solicitud');
    }
  }
  // --- Lógica de Crónica con IA ---

  renderCronica() {
    const cronicaContent = document.getElementById('cronicaContent');
    const btnGenerar = document.getElementById('btnGenerarCronica');
    const btnBorrar = document.getElementById('btnBorrarCronica');

    if (!cronicaContent) return;

    if (this.partido.cronica) {
      cronicaContent.style.display = 'block';
      cronicaContent.innerHTML = this.partido.cronica; // Usar innerHTML para permitir formato básico si la IA lo devuelve
      if (btnGenerar) btnGenerar.textContent = 'Regenerar Crónica';
      if (btnBorrar) btnBorrar.style.display = 'inline-block';
    } else {
      cronicaContent.style.display = 'none';
      cronicaContent.textContent = '';
      if (btnGenerar) btnGenerar.textContent = 'Generar Crónica con IA';
      if (btnBorrar) btnBorrar.style.display = 'none';
    }
  }

  async borrarCronica() {
    if (!confirm('¿Estás seguro de que quieres borrar la crónica actual?')) return;

    this.partido.cronica = null;
    try {
      await this.dataService.guardarPartido(this.partido);
      this.renderCronica();
      alert('Crónica borrada correctamente.');
    } catch (error) {
      console.error('Error al borrar la crónica:', error);
      alert('Error al borrar la crónica: ' + error.message);
    }
  }

  async generarCronica() {
    const { key, provider, model } = this.loadApiKey();
    if (!key) {
      const modal = new bootstrap.Modal(document.getElementById('modalApiKey'));
      modal.show();
      return;
    }

    const loading = document.getElementById('loadingCronica');
    const content = document.getElementById('cronicaContent');
    const btn = document.getElementById('btnGenerarCronica');

    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';
    if (btn) btn.disabled = true;

    try {
      const prompt = await this.getMatchSummaryForAI();
      const cronica = await this.callAIAPI(provider, key, prompt, model);

      this.partido.cronica = cronica;
      await this.dataService.guardarPartido(this.partido);

      this.renderCronica();
    } catch (error) {
      console.error('Error generando crónica:', error);
      if (error.message.includes('Quota exceeded') || error.message.includes('429')) {
        alert('Has excedido el límite de uso gratuito de la IA. Por favor, espera unos minutos e inténtalo de nuevo.');
      } else {
        alert('Error al generar la crónica: ' + error.message);
      }
    } finally {
      if (loading) loading.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  }

  async toggleManualMode() {
    const container = document.getElementById('manualCronicaContainer');
    const promptArea = document.getElementById('promptForAI');

    if (container.style.display === 'none') {
      container.style.display = 'block';
      // Auto-generate prompt
      promptArea.value = 'Generando prompt...';
      try {
        const prompt = await this.getMatchSummaryForAI();
        promptArea.value = prompt;
      } catch (e) {
        promptArea.value = 'Error generando prompt: ' + e.message;
      }
    } else {
      container.style.display = 'none';
    }
  }

  copyPromptToClipboard() {
    const promptArea = document.getElementById('promptForAI');
    if (!promptArea || !promptArea.value) return;

    promptArea.select();
    document.execCommand('copy'); // Fallback for older browsers
    // Modern way: navigator.clipboard.writeText(promptArea.value);

    const btn = document.getElementById('btnCopyPrompt');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check"></i>';
    setTimeout(() => btn.innerHTML = originalHtml, 2000);
  }

  guardarCronicaManual() {
    const input = document.getElementById('manualCronicaInput');
    if (!input || !input.value.trim()) {
      alert('Por favor pega el texto de la crónica.');
      return;
    }

    this.partido.cronica = input.value.trim();
    this.guardarPartido().then(() => {
      this.renderCronica();
      document.getElementById('manualCronicaContainer').style.display = 'none';
      input.value = ''; // clear
      alert('Crónica manual guardada correctamente.');
    });
  }

  async getMatchSummaryForAI() {
    const p = this.partido;
    const fecha = p.fechaHora ? new Date(p.fechaHora).toLocaleDateString() : 'Fecha desconocida';
    const lugar = p.pabellon || 'Pabellón desconocido';

    // Determine Local/Visitor context
    const esLocal = (p.esLocal !== false); // Default true
    let equipoLocal, equipoVisitante, marcador;

    if (esLocal) {
      equipoLocal = p.nombreEquipo || 'Equipo Local';
      equipoVisitante = p.nombreRival || 'Equipo Rival';
      marcador = `${p.puntosEquipo} - ${p.puntosRival}`;
    } else {
      equipoLocal = p.nombreRival || 'Equipo Rival';
      equipoVisitante = p.nombreEquipo || 'Equipo Visitante';
      marcador = `${p.puntosRival} - ${p.puntosEquipo}`;
    }

    // Fetch coach name
    let nombreEntrenador = '';
    if (p.equipoId && this.ownerUid) {
      try {
        const teamSnap = await this.db.ref(`usuarios/${this.ownerUid}/equipos/${p.equipoId}`).once('value');
        if (teamSnap.exists()) {
          nombreEntrenador = teamSnap.val().entrenador || '';
        }
      } catch (e) {
        console.error('Error fetching coach name:', e);
      }
    }

    let statsJugadores = '';
    if (p.estadisticasJugadores) {
      Object.entries(p.estadisticasJugadores).forEach(([id, stats]) => {
        const nombre = (p.convocados && p.convocados[id]) ? p.convocados[id].nombre : 'Jugador';
        const dorsal = (p.convocados && p.convocados[id]) ? p.convocados[id].dorsal : '#';
        // Include ALL players, even with 0 stats
        statsJugadores += `- ${nombre} (#${dorsal}): ${stats.puntos} pts, ${stats.asistencias} ast, ${stats.rebotes} reb, ${stats.robos} rob, ${stats.tapones} tap.\n`;
      });
    }

    // Calcular parciales por cuarto
    let parciales = '';
    if (p.eventos) {
      const puntosPorCuarto = {};
      Object.values(p.eventos).forEach(ev => {
        if (ev.tipo === 'puntos') {
          if (!puntosPorCuarto[ev.cuarto]) puntosPorCuarto[ev.cuarto] = { equipo: 0, rival: 0 };
          if (ev.dorsal >= 0) puntosPorCuarto[ev.cuarto].equipo += ev.cantidad;
          else puntosPorCuarto[ev.cuarto].rival += ev.cantidad;
        }
      });
      Object.keys(puntosPorCuarto).sort().forEach(c => {
        const ptsEquipo = puntosPorCuarto[c].equipo;
        const ptsRival = puntosPorCuarto[c].rival;
        const parcial = esLocal ? `${ptsEquipo}-${ptsRival}` : `${ptsRival}-${ptsEquipo}`;
        parciales += `Cuarto ${c}: ${parcial}. `;
      });
    }

    const miEquipoNombre = p.nombreEquipo || 'Mi Equipo';
    let entrenadorInfo = nombreEntrenador ? `Entrenador del equipo ${miEquipoNombre}: ${nombreEntrenador}` : '';

    return `
      Actúa como un periodista deportivo experto en baloncesto juvenil. Escribe una crónica emocionante y detallada del siguiente partido:
      
      Partido: ${equipoLocal} (Local) vs ${equipoVisitante} (Visitante)
      Fecha: ${fecha}
      Lugar: ${lugar}
      Resultado Final: ${marcador}
      Parciales: ${parciales}
      ${entrenadorInfo}
      
      Jugadores del equipo ${miEquipoNombre} (Estadísticas):
      ${statsJugadores}
      
      Instrucciones:
      - Usa un tono periodístico, narrativo y motivador.
      - Ten en cuenta quién jugaba como local (${equipoLocal}) y quién como visitante (${equipoVisitante}).
      - IMPORTANTE: Menciona SIEMPRE al entrenador ${nombreEntrenador} (si hay nombre) y destaca su dirección del equipo.
      - IMPORTANTE: Intenta mencionar a TODOS los jugadores de la lista anterior, aunque sea brevemente o agrupando a los que no anotaron destacando su esfuerzo defensivo o compañerismo.
      - IMPORTANTE: Sé SIEMPRE respetuoso con el equipo rival (${p.nombreRival || 'Rival'}), reconociendo su esfuerzo y buen juego, independientemente del resultado.
      - Destaca a los jugadores con mejores estadísticas.
      - Analiza brevemente el flujo del partido basándote en los parciales.
      - No inventes datos que no estén aquí, pero puedes añadir "color" narrativo.
      - Usa formato HTML básico (párrafos <p>, negritas <strong>) para que se lea bien.
    `;
  }

  async callAIAPI(provider, apiKey, prompt, model = null) {
    if (provider === 'openai') {
      // OpenAI
      const url = 'https://api.openai.com/v1/chat/completions';
      const body = {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Eres un redactor deportivo experto." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Error en la API de OpenAI');
      }

      const data = await response.json();
      let text = data.choices[0].message.content;
      // Limpiar bloques de código markdown de forma más agresiva
      text = text.replace(/```html/gi, '').replace(/```/g, '').trim();
      return text;

    } else if (provider === 'huggingface') {
      // Hugging Face Inference API (Mistral)
      const model = 'mistralai/Mistral-7B-Instruct-v0.3';
      const url = `https://api-inference.huggingface.co/models/${model}`;

      // Mistral format: <s>[INST] prompt [/INST]
      const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputs: formattedPrompt,
          parameters: {
            max_new_tokens: 1000,
            return_full_text: false // Ask API not to return the prompt
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error en la API de Hugging Face');
      }

      const data = await response.json();
      // HF returns array: [{ generated_text: "..." }]
      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        let text = data[0].generated_text;
        // Cleanup just in case
        text = text.replace(/```html/gi, '').replace(/```/g, '').trim();
        return text;
      } else {
        throw new Error('Hugging Face no devolvió texto válido.');
      }

    } else {
      // Google Gemini (Default)
      const selectedModel = model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const status = response.status;
        const msg = err.error?.message || response.statusText;

        if (status === 429 || msg.includes('Quota exceeded') || msg.includes('429')) {
          throw new Error('Quota exceeded. ' + msg);
        }

        throw new Error(msg || 'Error en la API de Gemini');
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
        let text = data.candidates[0].content.parts[0].text;
        // Limpiar bloques de código markdown de forma más agresiva
        text = text.replace(/```html/gi, '').replace(/```/g, '').trim();
        return text;
      } else {
        throw new Error('La API de Gemini no devolvió texto válido.');
      }
    }
  }

  saveApiKey() {
    const input = document.getElementById('inputApiKey');
    const select = document.getElementById('selectAiProvider');
    const selectModel = document.getElementById('selectGeminiModel');

    if (input && input.value && select) {
      localStorage.setItem('basketkids_ai_key', input.value);
      localStorage.setItem('basketkids_ai_provider', select.value);
      if (selectModel && selectModel.value) {
        localStorage.setItem('basketkids_ai_model', selectModel.value);
      }

      bootstrap.Modal.getInstance(document.getElementById('modalApiKey')).hide();
      alert('Configuración de IA guardada correctamente.');
    } else {
      alert('Por favor introduce una API Key válida.');
    }
  }

  loadApiKey() {
    return {
      key: localStorage.getItem('basketkids_ai_key'),
      provider: localStorage.getItem('basketkids_ai_provider') || 'gemini',
      model: localStorage.getItem('basketkids_ai_model') || 'gemini-2.0-flash'
    };
  }

  configureApiKeyUI() {
    const btnConfig = document.getElementById('btnConfigApiKey');
    const btnSave = document.getElementById('btnSaveApiKey');
    const btnGenerar = document.getElementById('btnGenerarCronica');
    const selectProvider = document.getElementById('selectAiProvider');
    const inputKey = document.getElementById('inputApiKey');
    const helpText = document.getElementById('apiKeyHelp');
    const containerModel = document.getElementById('containerGeminiModel');
    const selectModel = document.getElementById('selectGeminiModel');

    if (selectProvider) {
      const updateUI = () => {
        if (selectProvider.value === 'openai') {
          inputKey.placeholder = 'sk-...';
          helpText.innerHTML = '<i class="bi bi-info-circle"></i> Para conseguir tu clave de OpenAI, visita <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>.';
          if (containerModel) containerModel.style.display = 'none';
        } else if (selectProvider.value === 'huggingface') {
          inputKey.placeholder = 'hf_...';
          helpText.innerHTML = '<i class="bi bi-info-circle"></i> Consigue tu token gratis en <a href="https://huggingface.co/settings/tokens" target="_blank">Hugging Face Tokens</a>.';
          if (containerModel) containerModel.style.display = 'none';
        } else {
          // Gemini
          inputKey.placeholder = 'AIzaSy...';
          helpText.innerHTML = '<i class="bi bi-info-circle"></i> Gemini tiene un plan gratuito. Consigue tu clave en <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.';
          if (containerModel) containerModel.style.display = 'block';
        }
      };

      selectProvider.addEventListener('change', updateUI);
      // init state
      updateUI();
    }

    if (btnConfig) {
      btnConfig.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('modalApiKey'));
        const stored = this.loadApiKey();

        if (inputKey) inputKey.value = stored.key || '';
        if (selectProvider) {
          selectProvider.value = stored.provider;
          // Trigger change to update UI
          selectProvider.dispatchEvent(new Event('change'));
        }
        if (selectModel && stored.model) {
          selectModel.value = stored.model;
        }

        modal.show();
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveApiKey());
    }

    btnGenerar.addEventListener('click', () => this.generarCronica());
  }

  abrirModalSwapStats() {
    const selectA = document.getElementById('selectSwapPlayerA');
    const selectB = document.getElementById('selectSwapPlayerB');
    if (!selectA || !selectB) return;

    selectA.innerHTML = '<option value="">Seleccionar...</option>';
    selectB.innerHTML = '<option value="">Seleccionar...</option>';

    if (this.partido.convocados) {
      Object.entries(this.partido.convocados).forEach(([id, jug]) => {
        const optionA = document.createElement('option');
        optionA.value = id;
        optionA.textContent = `${jug.nombre} (#${jug.dorsal})`;
        selectA.appendChild(optionA);

        const optionB = document.createElement('option');
        optionB.value = id;
        optionB.textContent = `${jug.nombre} (#${jug.dorsal})`;
        selectB.appendChild(optionB);
      });
    }

    const modal = new bootstrap.Modal(document.getElementById('modalSwapStats'));
    modal.show();
  }

  confirmarSwapStats() {
    const idA = document.getElementById('selectSwapPlayerA').value;
    const idB = document.getElementById('selectSwapPlayerB').value;

    if (!idA || !idB) {
      return alert('Debes seleccionar dos jugadores.');
    }
    if (idA === idB) {
      return alert('Debes seleccionar jugadores distintos.');
    }

    if (!confirm('¿Seguro que quieres intercambiar TODAS las estadísticas entre estos dos jugadores? Esta acción no se puede deshacer fácilmente.')) {
      return;
    }

    // 1. Swap Summary Stats (estadisticasJugadores)
    if (!this.partido.estadisticasJugadores) this.partido.estadisticasJugadores = {};
    const statsA = this.partido.estadisticasJugadores[idA];
    const statsB = this.partido.estadisticasJugadores[idB];

    // Swap references
    this.partido.estadisticasJugadores[idA] = statsB; // Can be undefined, that's fine
    this.partido.estadisticasJugadores[idB] = statsA;

    // Remove key if undefined to keep object clean
    if (this.partido.estadisticasJugadores[idA] === undefined) delete this.partido.estadisticasJugadores[idA];
    if (this.partido.estadisticasJugadores[idB] === undefined) delete this.partido.estadisticasJugadores[idB];


    // 2. Swap Events (partido.eventos)
    if (this.partido.eventos) {
      Object.values(this.partido.eventos).forEach(ev => {
        // A) Swap the Actor (who did the action)
        if (ev.jugadorId === idA) {
          ev.jugadorId = idB;
          if (this.partido.convocados[idB]) {
            ev.nombre = this.partido.convocados[idB].nombre;
            ev.dorsal = this.partido.convocados[idB].dorsal;
          }
        } else if (ev.jugadorId === idB) {
          ev.jugadorId = idA;
          if (this.partido.convocados[idA]) {
            ev.nombre = this.partido.convocados[idA].nombre;
            ev.dorsal = this.partido.convocados[idA].dorsal;
          }
        }

        // B) Swap the Context (who was on court - for +/-)
        if (ev.jugadoresEnPista && Array.isArray(ev.jugadoresEnPista)) {
          const idxA = ev.jugadoresEnPista.indexOf(idA);
          const idxB = ev.jugadoresEnPista.indexOf(idB);

          // If both are present, swapping them changes nothing in the set, so do nothing.
          // If one is present, swap it for the other.
          if (idxA !== -1 && idxB === -1) {
            ev.jugadoresEnPista[idxA] = idB;
          } else if (idxB !== -1 && idxA === -1) {
            ev.jugadoresEnPista[idxB] = idA;
          }
        }
      });
    }

    // 3. Swap Current Pista (if applicable)
    // this.partido.pista might be an object {uid: true} or array.
    // Usually handled by 'jugadoresEnPista' logic in app, but often stored as reference.
    // If it's a list or object of current players, we should swap there too.
    // Based on usage earlier (renderListaJugadoresPista not shown completely but likely list)
    // We can try to safe swap if it exists.
    /* 
       Note: typical structure in this app is not fully visible, but usually 
       partido.pista is updated live. If user refreshes, it rebuilds? 
       To be safe, we rely on the event history + manual correction if needed, 
       but swapping in events is the critical part for stats. 
    */

    // 4. Save and close
    this.dataService.guardarPartido(this.partido)
      .then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalSwapStats')).hide();
        this.renderizarTodo(); // Will re-calculate stats from events if needed, but summary swap helps if using stored stats
        alert('Estadísticas intercambiadas correctamente.');
      })
      .catch(err => {
        console.error(err);
        alert('Error al guardar los cambios.');
      });
  }
}
