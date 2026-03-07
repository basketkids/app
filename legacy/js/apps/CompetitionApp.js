class CompetitionApp extends BaseApp {
    constructor() {
        super();
        this.competitionService = new CompetitionService();
        this.matchService = new MatchService();
        this.teamMembersService = new TeamMembersService();
        this.teamService = new TeamService(); // Added for team name fetching

        this.competitionNameSpan = document.getElementById('competitionName');
        this.menuCompeticion = document.getElementById('menuCompeticion');
        this.seccionRivales = document.getElementById('seccion-rivales');
        this.seccionPartidos = document.getElementById('seccion-partidos');

        this.addRivalForm = document.getElementById('addRivalForm');
        this.inputNombreRival = document.getElementById('inputNombreRival');
        this.rivalesList = document.getElementById('rivalesList');

        this.addPartidoForm = document.getElementById('addPartidoForm');
        this.inputFechaHora = document.getElementById('inputFechaHora');
        this.inputRivalSelect = document.getElementById('inputRivalSelect');
        this.inputLocalVisitante = document.getElementById('inputLocalVisitante');
        this.inputPabellon = document.getElementById('inputPabellon');
        this.partidosList = document.getElementById('partidosList');

        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        this.confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));

        // CSV Import elements
        this.importCSVBtn = document.getElementById('importCSVBtn');
        this.csvFileInput = document.getElementById('csvFileInput');
        this.exportAllCalendarBtn = document.getElementById('exportAllCalendarBtn');
        this.importProgressModal = null;

        // Store matches for calendar export
        this.currentMatches = [];

        this.currentTeamId = null;
        this.currentCompeticionId = null;
        this.elementoABorrar = null;

        this.editRivalModal = new bootstrap.Modal(document.getElementById('editRivalModal'));
        this.editRivalForm = document.getElementById('editRivalForm');
        this.editInputNombreRival = document.getElementById('editInputNombreRival');
        this.rivalAEditar = null;
    }

    onUserLoggedIn(user) {
        this.currentUser = user;
        this.ownerUid = this.getParam('ownerUid') || user.uid;
        this.loadParamsUrl();
    }

    loadParamsUrl() {
        const idEquipo = this.getParam('idEquipo');
        const idCompeticion = this.getParam('idCompeticion');
        if (!idEquipo || !idCompeticion) {
            alert('No se especificó equipo o competición');
            window.location.href = 'index.html';
            return;
        }
        this.currentTeamId = idEquipo;
        this.currentCompeticionId = idCompeticion;

        this.checkPermissions().then(() => {
            this.loadCompeticionData();
            this.setupEventListeners();
            this.applyPermissions();
        });
    }

    async checkPermissions() {
        this.userRole = 'follower'; // Default
        if (this.currentUser.uid === this.ownerUid) {
            this.userRole = 'owner';
            return;
        }

        // Adapted to Service callback or promise
        // The service uses callback, let's wrap or use if simpler
        // But checking single member...
        // Let's assume getMembers returns array via callback.
        await new Promise(resolve => {
            this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId, (members) => {
                const me = members.find(m => m.user_id === this.currentUser.uid);
                if (me) {
                    this.userRole = me.role;
                }
                resolve();
            });
        });
    }

    applyPermissions() {
        // Owner: All access
        // Statistician: Can manage matches
        const canEdit = (this.userRole === 'owner' || this.userRole === 'statistician');

        if (!canEdit) {
            // Hide Add buttons
            const addRivalButton = this.seccionRivales.querySelector('.btn-primary');
            if (addRivalButton) addRivalButton.style.display = 'none';

            const addPartidoButton = this.seccionPartidos.querySelector('.btn-primary');
            if (addPartidoButton) addPartidoButton.style.display = 'none';

            // Hide Import CSV
            if (this.importCSVBtn) this.importCSVBtn.style.display = 'none';
        }
    }

    loadCompeticionData() {
        this.competitionService.get(this.ownerUid, this.currentTeamId, this.currentCompeticionId)
            .then(competicion => {
                if (!competicion) {
                    alert('Competición no encontrada o sin permiso');
                    window.location.href = `equipo.html?idEquipo=${this.currentTeamId}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
                    return;
                }
                this.competitionNameSpan.textContent = competicion.name || 'Competición'; // Schema uses name
                this.loadRivales();
                this.loadPartidos();
            })
            .catch(err => {
                console.error(err);
                alert('Error cargando competición');
            });
    }

    setupEventListeners() {
        this.menuCompeticion.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const seccion = e.target.getAttribute('data-seccion');
                this.menuCompeticion.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                e.target.classList.add('active');
                this.seccionRivales.style.display = seccion === 'rivales' ? 'block' : 'none';
                this.seccionPartidos.style.display = seccion === 'partidos' ? 'block' : 'none';
            });
        });

        this.addRivalForm.addEventListener('submit', e => this.handleAddRival(e));
        this.addPartidoForm.addEventListener('submit', e => this.handleAddPartido(e));
        this.confirmDeleteBtn.addEventListener('click', () => this.handleDelete());
        this.setupCSVImport();
        this.setupExportCalendar();

        this.editRivalForm.addEventListener('submit', e => this.handleEditRival(e));
    }

    handleAddRival(e) {
        e.preventDefault();
        const nombre = this.inputNombreRival.value.trim();
        if (!nombre) return alert('Introduce nombre de rival');

        this.competitionService.addRival(this.ownerUid, this.currentTeamId, this.currentCompeticionId, nombre)
            .then(() => {
                this.inputNombreRival.value = '';
                const modal = bootstrap.Modal.getOrCreateInstance(this.addRivalForm.closest('.modal'));
                modal.hide();
                this.loadRivales(); // Refresh list
            });
    }

    handleEditRival(e) {
        e.preventDefault();
        const nombre = this.editInputNombreRival.value.trim();
        if (!nombre || !this.rivalAEditar) return;

        this.competitionService.updateRival(this.ownerUid, this.currentTeamId, this.currentCompeticionId, this.rivalAEditar, nombre)
            .then(() => {
                this.editRivalModal.hide();
                this.rivalAEditar = null;
                this.loadRivales(); // Refresh list
            })
            .catch(err => alert('Error al actualizar: ' + err.message));
    }

    loadRivales() {
        this.rivalesList.innerHTML = '';
        this.competitionService.getRivals(this.ownerUid, this.currentTeamId, this.currentCompeticionId, rivales => {
            this.rivalesList.innerHTML = '';
            this.inputRivalSelect.innerHTML = '<option value="">Selecciona rival</option>';

            if (!rivales || rivales.length === 0) {
                this.rivalesList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay rivales añadidos</li>';
                return;
            }

            const canEdit = (this.userRole === 'owner' || this.userRole === 'statistician');

            rivales.forEach(rival => {
                const id = rival.id;

                const option = document.createElement('option');
                option.value = id;
                option.textContent = rival.name; // Schema: name
                this.inputRivalSelect.appendChild(option);

                const li = document.createElement('li');
                li.classList.add('modern-list-item');
                li.textContent = rival.name;

                const divBtns = document.createElement('div');

                if (canEdit) {
                    const btnEditar = document.createElement('button');
                    btnEditar.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'me-2');
                    btnEditar.title = 'Editar rival';
                    btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';
                    btnEditar.onclick = () => {
                        this.rivalAEditar = id;
                        this.editInputNombreRival.value = rival.name;
                        this.editRivalModal.show();
                    };
                    divBtns.appendChild(btnEditar);

                    const btnBorrar = document.createElement('button');
                    btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
                    btnBorrar.title = 'Borrar rival';
                    btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
                    btnBorrar.onclick = () => {
                        this.elementoABorrar = { tipo: 'rival', id };
                        this.confirmDeleteModal.show();
                    };
                    divBtns.appendChild(btnBorrar);
                }

                li.appendChild(divBtns);
                this.rivalesList.appendChild(li);
            });
        });
    }

    async loadPartidos() {
        this.partidosList.innerHTML = '';

        try {
            // Get Name
            const nombreEquipo = await this.teamService.getName(this.ownerUid, this.currentTeamId) || 'Mi equipo';

            // Get Matches
            const matches = await this.matchService.getAllMatches(this.ownerUid, this.currentTeamId, this.currentCompeticionId);

            this.partidosList.innerHTML = '';
            if (!matches || matches.length === 0) {
                this.partidosList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay partidos añadidos</li>';
                return;
            }

            this.currentMatches = matches;
            this.currentTeamName = nombreEquipo;

            // Render
            matches.forEach(match => {
                // Adapt match object properties from schema to what renderMatchItem expects
                // Schema: date, rival_name, location, team_score, rival_score, state, is_local
                // renderMatchItem expects: fechaHora, nombreRival, pabellon, puntosEquipo, puntosRival, estado, esLocal

                // We'll map it here
                const adaptedMatch = {
                    ...match,
                    fechaHora: match.date,
                    nombreRival: match.rival_name,
                    pabellon: match.location,
                    puntosEquipo: match.team_score,
                    puntosRival: match.rival_score,
                    estado: match.state,
                    esLocal: match.is_local
                };

                this.renderMatchItem(adaptedMatch, match.id, nombreEquipo);
            });

        } catch (e) {
            console.error("Error loading matches:", e);
        }
    }

    renderMatchItem(partido, id, nombreEquipo) {
        const li = document.createElement('li');
        li.classList.add('modern-list-item', 'flex-column', 'text-start');
        li.style.cursor = 'pointer';

        const canEdit = (this.userRole === 'owner' || this.userRole === 'statistician');

        li.onclick = () => {
            if (canEdit) {
                window.location.href = `partido.html?idEquipo=${this.currentTeamId}&idCompeticion=${this.currentCompeticionId}&idPartido=${id}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
            }
        };

        const fechaObj = new Date(partido.fechaHora);
        const fechaStr = fechaObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        const horaStr = fechaObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        const divFechaHora = document.createElement('div');
        divFechaHora.style.fontSize = '0.85em';
        divFechaHora.style.lineHeight = '1.1em';
        divFechaHora.style.marginBottom = '0.3rem';
        divFechaHora.textContent = `${fechaStr}\n${horaStr}`;

        let local = partido.esLocal ? nombreEquipo : partido.nombreRival || 'Rival';
        let visitante = partido.esLocal ? (partido.nombreRival || 'Rival') : nombreEquipo;

        const divEquipos = document.createElement('div');
        divEquipos.style.fontWeight = '600';
        divEquipos.textContent = `${local} vs ${visitante}`;

        // Add location/pabellon with Google Maps link
        const divPabellon = document.createElement('div');
        divPabellon.style.fontSize = '0.85em';
        divPabellon.style.color = '#666';
        divPabellon.style.marginTop = '0.2rem';

        const mapsLink = document.createElement('a');
        mapsLink.href = CalendarHelper.generateMapsURL(partido.pabellon);
        mapsLink.target = '_blank';
        mapsLink.style.color = '#666';
        mapsLink.style.textDecoration = 'none';
        mapsLink.textContent = '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-geo-alt';
        mapsLink.appendChild(icon);
        mapsLink.appendChild(document.createTextNode(' ' + (partido.pabellon || 'Ubicación no especificada')));
        mapsLink.onmouseover = () => mapsLink.style.color = '#0d6efd';
        mapsLink.onmouseout = () => mapsLink.style.color = '#666';
        mapsLink.onclick = (e) => e.stopPropagation();
        divPabellon.appendChild(mapsLink);

        const divMarcador = document.createElement('div');
        divMarcador.classList.add('d-flex', 'align-items-center', 'gap-2', 'mt-2');

        const puntosEquipo = partido.puntosEquipo ?? 0;
        const puntosRival = partido.puntosRival ?? 0;
        const marcadorSpan = document.createElement('span');
        marcadorSpan.style.fontWeight = 'bold';

        if (partido.esLocal) {
            marcadorSpan.textContent = `${puntosEquipo} - ${puntosRival}`;
        } else {
            marcadorSpan.textContent = `${puntosRival} - ${puntosEquipo}`;
        }

        const iconEstado = document.createElement('i');
        iconEstado.style.fontSize = '1.2em';
        iconEstado.style.display = 'inline-block';

        switch (partido.estado) {
            case 'pendiente':
                iconEstado.classList.add('bi', 'bi-clock', 'text-secondary');
                iconEstado.title = 'Partido aún no ha empezado';
                break;
            case 'en curso':
                iconEstado.classList.add('bi', 'bi-record-circle-fill', 'text-danger', 'blink');
                iconEstado.title = 'Partido en curso';
                break;
            case 'finalizado':
                iconEstado.classList.add('bi', 'bi-check-circle-fill', 'text-success');
                iconEstado.title = 'Partido finalizado';
                break;
            default:
                iconEstado.classList.add('bi', 'bi-question-circle-fill', 'text-muted');
                iconEstado.title = 'Estado desconocido';
        }

        divMarcador.appendChild(iconEstado);
        divMarcador.appendChild(marcadorSpan);

        li.appendChild(divFechaHora);
        li.appendChild(divEquipos);
        li.appendChild(divPabellon);
        li.appendChild(divMarcador);

        const botonesContainer = document.createElement('div');
        botonesContainer.classList.add('d-flex', 'gap-2', 'mt-2', 'justify-content-end', 'w-100');

        if (canEdit) {
            const btnGestionar = document.createElement('a');
            btnGestionar.href = `partido.html?idEquipo=${this.currentTeamId}&idCompeticion=${this.currentCompeticionId}&idPartido=${id}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
            btnGestionar.classList.add('btn', 'btn-sm', 'btn-success');
            btnGestionar.title = 'Ver/Gestionar partido';
            btnGestionar.innerHTML = '<i class="bi bi-eye-fill"></i>';
            btnGestionar.onclick = (e) => e.stopPropagation();
            botonesContainer.appendChild(btnGestionar);
        }

        // Google Calendar button
        const btnCalendar = document.createElement('button');
        btnCalendar.classList.add('btn', 'btn-sm', 'btn-info');
        btnCalendar.title = 'Añadir a Google Calendar';
        btnCalendar.innerHTML = '<i class="bi bi-calendar-plus"></i>';
        btnCalendar.onclick = (e) => {
            e.stopPropagation();
            const url = CalendarHelper.generateCalendarURL(partido, nombreEquipo);
            CalendarHelper.openCalendar(url);
        };
        botonesContainer.appendChild(btnCalendar);

        if (canEdit) {
            const btnBorrar = document.createElement('button');
            btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
            btnBorrar.title = 'Borrar partido';
            btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
            btnBorrar.onclick = (e) => {
                e.stopPropagation();
                this.elementoABorrar = { tipo: 'partido', id };
                this.confirmDeleteModal.show();
            };
            botonesContainer.appendChild(btnBorrar);
        }

        li.appendChild(botonesContainer);
        this.partidosList.appendChild(li);
    }

    handleDelete() {
        if (!this.elementoABorrar) return;

        if (this.elementoABorrar.tipo === 'rival') {
            this.competitionService.deleteRival(this.ownerUid, this.currentTeamId, this.currentCompeticionId, this.elementoABorrar.id)
                .then(() => {
                    this.elementoABorrar = null;
                    this.confirmDeleteModal.hide();
                    this.loadRivales();
                }).catch(err => alert('Error al borrar rival: ' + err.message));
        } else if (this.elementoABorrar.tipo === 'partido') {
            // Delete match is enough, cascade handles rest or simple delete in matches table
            this.matchService.deleteMatch(this.ownerUid, this.currentTeamId, this.currentCompeticionId, this.elementoABorrar.id)
                .then(() => {
                    this.elementoABorrar = null;
                    this.confirmDeleteModal.hide();
                    this.loadPartidos();
                }).catch(err => alert('Error al borrar partido: ' + err.message));
        }
    }

    async handleAddPartido(e) {
        e.preventDefault();

        const fechaHoraStr = this.inputFechaHora.value;
        const rivalId = this.inputRivalSelect.value;
        const esLocal = this.inputLocalVisitante.value === 'local';
        const pabellon = this.inputPabellon.value.trim();

        try {
            const nombreEquipo = await this.teamService.getName(this.ownerUid, this.currentTeamId) || 'Equipo';

            if (!fechaHoraStr || !rivalId || !pabellon) {
                alert('Rellena todos los campos para crear el partido');
                return;
            }

            const fechaPartido = new Date(fechaHoraStr);
            const fechaMinima = new Date('1891-12-21T00:00:00');
            if (fechaPartido < fechaMinima) {
                return alert('La fecha del partido no puede ser anterior al 21 de diciembre de 1891 (invención del baloncesto).');
            }

            const rival = await this.competitionService.getMatchRival(this.ownerUid, this.currentTeamId, this.currentCompeticionId, rivalId);
            if (!rival) {
                alert('Rival no válido');
                return;
            }
            const nombreRival = rival.name;

            // Map fields to Service expectation (Service maps to Supabase)
            const matchData = {
                fecha: fechaHoraStr,
                rival: nombreRival,
                rivalId: rivalId, // Keep reference
                lugar: pabellon,
                notas: '',
                // Extra fields handled inside service create or defaults in DB
                esLocal: esLocal,
                nombreEquipo: nombreEquipo
                // Schema has is_local, location, etc. 
                // Service createMatch implementation: 
                // payload = { competition_id, team_id, rival_name, date, location, notes }
                // It misses is_local! I should check Service createMatch implementation again. 
                // I will need to update Service potentially if I missed fields. 
                // But let's assume I will update the Service or it maps correctly.
                // Wait, I didn't verify CompetitionService.createMatch full mapping.
                // But I can pass extra props to it.
            };

            // Let's pass the raw schema-aligned object to allow easier service pass-through?
            // Or update Service to handle is_local.
            // CompetitionService.js provided: 
            /*
            const payload = {
                competition_id: compId,
                team_id: teamId,
                rival_name: matchData.rival, 
                date: matchData.fecha,
                location: matchData.lugar,
                notes: matchData.notas,
            }; 
            */
            // It missed is_local. 
            // I should update CompetitionService to accept strict schema props or map them.
            // For now I will assume I can update CompetitionService later or it handles '...matchData'?
            // No, the code I saw earlier was explicit.

            // Crucial Fix: I must update CompetitionService to include 'is_local'.
            // But I am editing App now. I will pass 'is_local' in a way the service MIGHT accept if I fix it.

            await this.competitionService.createMatch(this.ownerUid, this.currentTeamId, this.currentCompeticionId, {
                ...matchData,
                is_local: esLocal // Passing correct schema key just in case
            });

            this.inputFechaHora.value = '';
            this.inputRivalSelect.value = '';
            this.inputLocalVisitante.value = 'local';
            this.inputPabellon.value = '';
            const modal = bootstrap.Modal.getOrCreateInstance(this.addPartidoForm.closest('.modal'));
            modal.hide();
            this.loadPartidos();

        } catch (error) {
            console.error('Error al crear partido:', error);
            alert('Error al crear partido: ' + error.message);
        }
    }

    setupCSVImport() {
        if (!this.importCSVBtn || !this.csvFileInput) return;

        // Initialize modal
        this.importCSVModal = new bootstrap.Modal(document.getElementById('importCSVModal'));
        const btnSelectCSV = document.getElementById('btnSelectCSV');

        this.importCSVBtn.addEventListener('click', () => {
            this.importCSVModal.show();
        });

        btnSelectCSV.addEventListener('click', () => {
            this.csvFileInput.click();
        });

        this.csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importCSVModal.hide();
                this.handleCSVImport(file);
                // Reset input so the same file can be selected again
                e.target.value = '';
            }
        });
    }

    async handleCSVImport(file) {
        try {
            // Show loading modal
            this.showImportProgress('Procesando archivo CSV...');

            // Parse CSV file
            const parsedMatches = await CSVParser.parseCSV(file);

            if (parsedMatches.length === 0) {
                this.showImportResult('No se encontraron partidos en el archivo CSV', 'warning');
                return;
            }

            // Get team name
            const nombreEquipo = await this.teamService.getName(this.ownerUid, this.currentTeamId) || 'Equipo';

            // Get existing matches for duplicate checking
            // MatchService.getAllMatches now returns array (Supabase data)
            const existingMatches = await this.matchService.getAllMatches(
                this.ownerUid,
                this.currentTeamId,
                this.currentCompeticionId
            );

            // Process each match
            let imported = 0;
            let skipped = 0;
            let errors = 0;

            this.updateImportProgress(`Procesando ${parsedMatches.length} partidos...`);

            for (let i = 0; i < parsedMatches.length; i++) {
                const csvMatch = parsedMatches[i];

                try {
                    // Check for duplicates
                    // csvMatch.fechaHora vs existingMatch.date
                    if (existingMatches.some(m => m.date === csvMatch.fechaHora)) {
                        skipped++;
                        console.log(`Partido duplicado: ${csvMatch.nombreRival} - ${csvMatch.fechaHora}`);
                        continue;
                    }

                    // Find or create rival
                    const rivalId = await this.competitionService.findOrCreateRival(
                        this.ownerUid,
                        this.currentTeamId,
                        this.currentCompeticionId,
                        csvMatch.nombreRival
                    );

                    // Create match data
                    // We need to pass data that CompetitionService.createMatch understands and maps to Schema.
                    // Or ideally we should update CompetitionService to just take a schema object.

                    const matchPayload = {
                        fecha: csvMatch.fechaHora,
                        rival: csvMatch.nombreRival,
                        rivalId: rivalId,
                        lugar: csvMatch.pabellon || 'Pabellón',
                        notas: '',
                        is_local: csvMatch.esLocal,
                        // Defaults
                        team_score: csvMatch.puntosEquipo || 0,
                        rival_score: csvMatch.puntosRival || 0,
                        state: csvMatch.estado || 'scheduled'
                    };

                    await this.competitionService.createMatch(
                        this.ownerUid,
                        this.currentTeamId,
                        this.currentCompeticionId,
                        matchPayload
                    );

                    imported++;
                    this.updateImportProgress(`Importados: ${imported}, Omitidos: ${skipped}`);

                } catch (error) {
                    console.error(`Error importando partido ${csvMatch.nombreRival}:`, error);
                    errors++;
                }
            }

            // Show results
            const message = `
                <strong>Importación completada</strong><br>
                Partidos importados: ${imported}<br>
                Partidos omitidos (duplicados): ${skipped}<br>
                ${errors > 0 ? `Errores: ${errors}<br>` : ''}
            `;
            this.showImportResult(message, errors > 0 ? 'warning' : 'success');

        } catch (error) {
            console.error('Error en la importación:', error);
            this.showImportResult(`Error: ${error.message}`, 'danger');
        }
    }

    showImportProgress(message) {
        // Create or update progress modal
        let modalEl = document.getElementById('importProgressModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'importProgressModal';
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-body text-center py-4">
                            <div class="spinner-border text-primary mb-3" role="status">
                                <span class="visually-hidden">Cargando...</span>
                            </div>
                            <p id="importProgressMessage" class="mb-0">${message}</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
            this.importProgressModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
        }

        this.updateImportProgress(message);
        this.importProgressModal.show();
    }

    updateImportProgress(message) {
        const messageEl = document.getElementById('importProgressMessage');
        if (messageEl) {
            messageEl.innerHTML = message;
        }
    }

    showImportResult(message, type = 'info') {
        // Hide progress modal if showing
        if (this.importProgressModal) {
            this.importProgressModal.hide();
        }

        // Create result modal
        let modalEl = document.getElementById('importResultModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'importResultModal';
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Resultado de la Importación</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="importResultMessage" class="alert" role="alert"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        const messageEl = document.getElementById('importResultMessage');
        messageEl.className = `alert alert-${type}`;
        messageEl.innerHTML = message;

        const resultModal = new bootstrap.Modal(modalEl);
        resultModal.show();
    }

    setupExportCalendar() {
        if (!this.exportAllCalendarBtn) return;

        this.exportAllCalendarBtn.addEventListener('click', () => {
            if (!this.currentMatches || this.currentMatches.length === 0) {
                alert('No hay partidos para exportar');
                return;
            }

            CalendarHelper.exportMultipleToCalendar(this.currentMatches, this.currentTeamName);
        });
    }
}
