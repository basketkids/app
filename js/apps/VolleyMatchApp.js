class VolleyMatchApp extends MatchBaseApp {
    constructor() {
        super();
        // Specific UI Elements for Volley
        this.selectConfiguracion = document.getElementById('selectConfiguracion'); // If we share config logic
        // Volley doesn't use quarters, uses Sets.
        // We might repurpose selectCuarto as selectSet or create specific UI
        this.selectSet = document.getElementById('selectCuarto'); // Reusing existing ID for simplicity in HTML clone, or rename?
        // Let's use specific IDs in the new HTML, but for now assuming we clone.
        // But better to rename in HTML to 'selectSet' and 'btnTerminarSet'
        this.btnTerminarSet = document.getElementById('btnTerminarCuarto'); // Will rename in HTML

        // Volley Specific State
        // Sets won, etc.
    }

    onMatchLoaded() {
        // Config for Volley
        this.partido.totalPartes = this.partido.totalPartes || 5; // Max 5 sets
        this.partido.duracionParte = 0; // No timer validation needed really, or count UP?
        // Volley usually has no time limit. But we might want to track duration.
        // Timer acts as elapsed time?
        // For now, keep existing timer logic but maybe not auto-stop?
    }

    getDefaultParteDuration() {
        return 0; // Or 20 mins? Volley doesn't have fixed duration.
        // Maybe we want a "Count Up" timer?
        // existing timer counts down.
        // Let's set a large duration to avoid "End of Time" event
        return 60 * 60; // 1 hour per set default buffer
    }

    renderizarTodo() {
        this.renderListaJugadoresPlantilla();
        this.renderListaJugadoresConvocados();
        this.renderListaJugadoresPista();
        this.renderEventosEnVivo();
        this.actualizarDisplay();
        this.actualizarBotonesPorEstado();
        this.actualizarMarcadorySets();
        this.renderNombresEquipos();
        this.renderInfoPartido();
        this.actualizarLinksPublicos();
        this.renderCronica();
        // No fantasy/quintetos logic for Volley yet? Or maybe yes.
        // Hide them if not applicable
    }

    actualizarMarcadorySets() {
        // Calculate Sets Won
        // Logic: Iterate sets (partes) and check score
        // Does 'partido' store score per set?
        // We need to implement score tracking PER SET.
        // 'partido.puntosEquipo' is TOTAL?
        // Usually scoreboard shows Sets: 2 - 1, and current set points.
        // WE NEED TO CHANGE DATA STRUCTURE or calculation.

        // Existing: 'partido.eventos' -> filter by 'cuarto' (set) -> sum points.
        // This works for "Current Set Score"
        // But for "Sets Won", we need to sum up finalized sets.

        let setsLocal = 0;
        let setsRival = 0;

        // Calculate score for each previous set
        for (let i = 1; i < this.partido.parteActual; i++) {
            const score = this.calculateSetScore(i);
            if (score.local > score.rival) setsLocal++;
            else if (score.rival > score.local) setsRival++;
        }

        // Current Set Score
        const currentScore = this.calculateSetScore(this.partido.parteActual);
        this.partido.puntosEquipo = currentScore.local;
        this.partido.puntosRival = currentScore.rival;

        // Save Sets Count to object (and DB eventually via guardarPartido or guardarDatos)
        this.partido.setsEquipo = setsLocal;
        this.partido.setsRival = setsRival;

        // Ensure we save these updates if this method is called after an event
        // Note: _agregarEstadisticaInternal calls guardarPartido implicitly via DataService? 
        // No, MatchBaseApp methods usually save. generic 'agregarEstadistica' saves event.
        // We probably want to save the updated summary fields.
        if (this.dataService) {
            this.dataService.guardarDatos('puntosEquipo', this.partido.puntosEquipo);
            this.dataService.guardarDatos('puntosRival', this.partido.puntosRival);
            this.dataService.guardarDatos('setsEquipo', this.partido.setsEquipo);
            this.dataService.guardarDatos('setsRival', this.partido.setsRival);
        }

        // Update DOM
        // Reuse 'marcadorEquipo' / 'marcadorRival' for CURRENT SET points
        const marcadorLocal = document.getElementById('marcadorEquipo');
        const marcadorRival = document.getElementById('marcadorRival');

        if (marcadorLocal) marcadorLocal.textContent = currentScore.local;
        if (marcadorRival) marcadorRival.textContent = currentScore.rival;

        // Update Sets Display
        // We need a place to show sets.
        // Maybe reuse 'faltas' container or create new one?
        // In Basket: Faltas 2 - 4
        // In Volley: Sets 1 - 0
        const indicadortitulo = document.getElementById('tituloIndicadorSecundario'); // "FALTAS"
        const indicadorLocal = document.getElementById('indicadorSecundarioLocal');
        const indicadorRival = document.getElementById('indicadorSecundarioRival');

        if (indicadortitulo) indicadortitulo.textContent = "SETS";
        if (indicadorLocal) indicadorLocal.textContent = setsLocal;
        if (indicadorRival) indicadorRival.textContent = setsRival;
    }

    calculateSetScore(setNumber) {
        let local = 0;
        let rival = 0;
        const eventos = Object.values(this.partido.eventos || {});
        eventos.forEach(ev => {
            if (ev.cuarto === setNumber) {
                if (ev.tipo === 'puntos') {
                    // Check if rival
                    // Rival points handling:
                    // logic in MatchRenderer was: dorsal === -1 -> rival point
                    // generic 'puntos' -> local point
                    // But wait, my MatchRenderer fix logic:
                    if (ev.dorsal === -1) {
                        rival += (ev.cantidad || 0);
                    } else {
                        local += (ev.cantidad || 0);
                    }
                }
            }
        });
        return { local, rival };
    }

    prepararEventos() {
        super.prepararEventos();

        // Rebind Terminar Set
        // We expect HTML to have specific ID or reuse 'btnTerminarCuarto'
        const btnEndSet = document.getElementById('btnTerminarCuarto');
        if (btnEndSet) {
            btnEndSet.textContent = "Terminar Set";
            btnEndSet.addEventListener('click', () => this.terminarSet());
        }

        // Action Panel
        this.renderActionButtons();
        const actionPanel = document.getElementById('action-controls-footer');
        if (actionPanel) {
            actionPanel.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const action = btn.dataset.action;
                // Generic handlers
                if (action) {
                    this.triggerButtonEffect(btn);
                    this.handleActionPanelClick(action, 1);
                }

                // Specific IDs (Generic Points)
                if (btn.id === 'btnTeamPointGeneric') this.agregarEstadistica('', 'puntos', 1);
                if (btn.id === 'btnRivalPointGeneric') this.agregarEstadistica('', 'puntos', 1, null, true);
            });
        }
    }

    handleActionPanelClick(action, value) {
        if (!this.selectedPlayerId && !['puntos', 'error_saque', 'error_ataque'].includes(action)) {
            // Allow some actions without player? No, usually need player for stats.
            // Generic points handled by specific Buttons IDs listener above logic?
            // Actually the listener above calls this for data-action buttons.
        }

        // Logic from PartidoApp for Volley
        const p = this.selectedPlayerId;

        if (['ace', 'ataque', 'bloqueo'].includes(action)) {
            if (!p) { alert("Selecciona jugador"); return; }
            this.agregarEstadistica(p, action, 1);
            this.agregarEstadistica(p, 'puntos', 1); // Also add point
        } else if (['error_saque', 'error_ataque'].includes(action)) {
            if (!p) { alert("Selecciona jugador"); return; }
            this.agregarEstadistica(p, action, 1);
            this.agregarEstadistica(null, 'puntos', 1, null, true); // Rival Point
        } else if (action === 'recepcion') {
            if (!p) { alert("Selecciona jugador"); return; }
            this.agregarEstadistica(p, action, 1);
        }
    }

    onStatAdded() {
        this.actualizarMarcadorySets(); // Recalculate generic score
        this.renderEventosEnVivo();
        this.selectedPlayerId = null;
        this.renderListaJugadoresPista();
    }

    terminarSet() {
        if (confirm('¿Terminar Set actual?')) {
            this.partido.parteActual++;
            // Reset generic set vars if any?
            this.dataService.guardarPartido(this.partido);
            this.actualizarDisplay(); // Reset timer?
            // Count UP timer might need reset
            this.segundosRestantes = this.getDefaultParteDuration();
            this.actualizarBotonesPorEstado();
        }
    }

    renderActionButtons() {
        const container = document.getElementById('action-controls-footer');
        if (!container) return;

        // Volley HTML structure
        container.innerHTML = `
          <div class="d-flex flex-column gap-2">
            <div class="d-flex gap-2 justify-content-between">
              <button class="btn btn-success flex-grow-1 action-btn" data-action="ace" title="Punto Directo Saque">ACE</button>
              <button class="btn btn-success flex-grow-1 action-btn" data-action="ataque" title="Punto Ataque">ATK</button>
              <button class="btn btn-success flex-grow-1 action-btn" data-action="bloqueo" title="Punto Bloqueo">BLK</button>
            </div>
            <div class="d-flex gap-2 justify-content-between align-items-center">
               <button class="btn btn-outline-danger flex-grow-1 action-btn" data-action="error_saque" title="Error Saque">Err S</button>
               <button class="btn btn-outline-danger flex-grow-1 action-btn" data-action="error_ataque" title="Error Ataque">Err A</button>
               <button class="btn btn-outline-secondary flex-grow-1 action-btn" data-action="recepcion" title="Recepción">REC</button>
            </div>
            <div class="d-flex gap-2 justify-content-center border-top pt-2 mt-1">
              <button class="btn btn-sm btn-primary flex-grow-1" id="btnTeamPointGeneric" title="Punto sin asignar">+1 Equipo</button>
              <div class="vr"></div>
              <button class="btn btn-sm btn-secondary flex-grow-1" id="btnRivalPointGeneric" title="Punto Rival">+1 Rival</button>
            </div>
          </div>
          `;
    }

    // Methods inherited from MatchBaseApp (renderListaJugadoresPlantilla, etc.) are used directly.
}
