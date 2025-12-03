class CompetitionApp extends BaseApp {
    constructor() {
        super();
        this.competitionService = new CompetitionService(this.db);
        this.matchService = new MatchService(this.db);
        this.teamMembersService = new TeamMembersService(this.db);

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

        const memberSnap = await this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId).once('value');
        if (memberSnap.exists() && memberSnap.hasChild(this.currentUser.uid)) {
            this.userRole = memberSnap.child(this.currentUser.uid).val().role;
        }
    }

    applyPermissions() {
        // Owner: All access
        // Statistician: Can manage matches (add/edit/delete match), but maybe not Rivals? 
        // User said: "Estadista: ... editar todo lo que tiene que ver con todos los partidos"
        // So Statistician can add matches. Can they add rivals? Usually needed for adding matches.
        // Let's allow Statistician to add Rivals too for convenience.
        // Follower/Player: Read only.

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
            .then(snap => {
                if (!snap.exists()) {
                    alert('Competición no encontrada o sin permiso');
                    window.location.href = `equipo.html?idEquipo=${this.currentTeamId}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
                    return;
                }
                const competicion = snap.val();
                this.competitionNameSpan.textContent = competicion.nombre || 'Competición';
                this.loadRivales();
                this.loadPartidos();
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
                // No need to reload everything, listener will update
            })
            .catch(err => alert('Error al actualizar: ' + err.message));
    }

    loadRivales() {
        this.rivalesList.innerHTML = '';
        this.competitionService.getRivals(this.ownerUid, this.currentTeamId, this.currentCompeticionId, snapshot => {
            this.rivalesList.innerHTML = '';
            this.inputRivalSelect.innerHTML = '<option value="">Selecciona rival</option>';

            if (!snapshot.exists()) {
                this.rivalesList.innerHTML = '<li class="list-group-item">No hay rivales añadidos</li>';
                return;
            }

            const canEdit = (this.userRole === 'owner' || this.userRole === 'statistician');

            snapshot.forEach(rivalSnap => {
                const rival = rivalSnap.val();
                const id = rivalSnap.key;

                const option = document.createElement('option');
                option.value = id;
                option.textContent = rival.nombre;
                this.inputRivalSelect.appendChild(option);

                const li = document.createElement('li');
                li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
                li.textContent = rival.nombre;

                const divBtns = document.createElement('div');

                if (canEdit) {
                    const btnEditar = document.createElement('button');
                    btnEditar.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'me-2');
                    btnEditar.title = 'Editar rival';
                    btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';
                    btnEditar.onclick = () => {
                        this.rivalAEditar = id;
                        this.editInputNombreRival.value = rival.nombre;
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

    loadPartidos() {
        this.partidosList.innerHTML = '';
        this.competitionService.getMatches(this.ownerUid, this.currentTeamId, this.currentCompeticionId, snapshot => {
            this.partidosList.innerHTML = '';
            if (!snapshot.exists()) {
                this.partidosList.innerHTML = '<li class="list-group-item">No hay partidos añadidos</li>';
                return;
            }

            this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.currentTeamId}/nombre`).once('value').then(nombreSnap => {
                const nombreEquipo = nombreSnap.exists() ? nombreSnap.val() : 'Mi equipo';

                // Convert to array and sort by date
                const partidos = [];
                snapshot.forEach(partidoSnap => {
                    partidos.push({
                        partido: partidoSnap.val(),
                        id: partidoSnap.key
                    });
                });

                // Sort by date (earliest first)
                partidos.sort((a, b) => {
                    const dateA = new Date(a.partido.fechaHora);
                    const dateB = new Date(b.partido.fechaHora);
                    return dateA - dateB;
                });

                // Store matches for calendar export
                this.currentMatches = partidos;
                this.currentTeamName = nombreEquipo;

                // Render sorted matches
                partidos.forEach(({ partido, id }) => {
                    this.renderMatchItem(partido, id, nombreEquipo);
                });
            });
        });
    }

    renderMatchItem(partido, id, nombreEquipo) {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center', 'flex-column', 'text-start');
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
                }).catch(err => alert('Error al borrar rival: ' + err.message));
        } else if (this.elementoABorrar.tipo === 'partido') {
            this.competitionService.deleteMatch(this.ownerUid, this.currentTeamId, this.currentCompeticionId, this.elementoABorrar.id)
                .then(() => {
                    this.matchService.deleteGlobal(this.elementoABorrar.id).then(() => {
                        this.elementoABorrar = null;
                        this.confirmDeleteModal.hide();
                    }).catch(err => alert('Error al borrar partido: ' + err.message));

                }).catch(err => alert('Error al borrar partido: ' + err.message));
        }
    }

    handleAddPartido(e) {
        e.preventDefault();

        const fechaHoraStr = this.inputFechaHora.value;
        const rivalId = this.inputRivalSelect.value;
        const esLocal = this.inputLocalVisitante.value === 'local';
        const pabellon = this.inputPabellon.value.trim();

        this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.currentTeamId}/nombre`).once('value').then(equipoSnap => {
            const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
            if (!fechaHoraStr || !rivalId || !pabellon) {
                alert('Rellena todos los campos para crear el partido');
                return;
            }

            const fechaPartido = new Date(fechaHoraStr);
            const fechaMinima = new Date('1891-12-21T00:00:00');
            if (fechaPartido < fechaMinima) {
                return alert('La fecha del partido no puede ser anterior al 21 de diciembre de 1891 (invención del baloncesto).');
            }

            this.competitionService.getMatchRival(this.ownerUid, this.currentTeamId, this.currentCompeticionId, rivalId)
                .then(rivalSnap => {
                    if (!rivalSnap.exists()) {
                        alert('Rival no válido');
                        return;
                    }
                    const nombreRival = rivalSnap.val().nombre;

                    const matchData = {
                        fechaHora: fechaHoraStr,
                        rivalId,
                        nombreRival,
                        nombreEquipo,
                        esLocal,
                        pabellon,
                        alineacion: {},
                        estadisticas: {},
                        puntosEquipo: 0,
                        puntosRival: 0,
                        faltasRival: 0,
                        estado: 'pendiente'
                    };

                    this.competitionService.createMatch(this.ownerUid, this.currentTeamId, this.currentCompeticionId, matchData)
                        .then((newRef) => {
                            const partidoId = newRef.key;
                            this.matchService.syncGlobal(this.ownerUid, this.currentTeamId, this.currentCompeticionId, partidoId);

                            this.inputFechaHora.value = '';
                            this.inputRivalSelect.value = '';
                            this.inputLocalVisitante.value = 'local';
                            this.inputPabellon.value = '';
                            const modal = bootstrap.Modal.getOrCreateInstance(this.addPartidoForm.closest('.modal'));
                            modal.hide();
                        })
                        .catch(error => {
                            console.error('Error al crear partido:', error);
                            alert('Error al crear partido: ' + error.message);
                        });
                });
        });
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
            const teamNameSnap = await this.db.ref(`usuarios/${this.ownerUid}/equipos/${this.currentTeamId}/nombre`).once('value');
            const nombreEquipo = teamNameSnap.exists() ? teamNameSnap.val() : 'Equipo desconocido';

            // Get existing matches for duplicate checking
            const existingMatchesSnap = await this.matchService.getAllMatches(
                this.ownerUid,
                this.currentTeamId,
                this.currentCompeticionId
            );
            const existingMatches = existingMatchesSnap.val();

            // Process each match
            let imported = 0;
            let skipped = 0;
            let errors = 0;

            this.updateImportProgress(`Procesando ${parsedMatches.length} partidos...`);

            for (let i = 0; i < parsedMatches.length; i++) {
                const csvMatch = parsedMatches[i];

                try {
                    // Check for duplicates
                    if (MatchService.checkDuplicate(existingMatches, csvMatch.fechaHora)) {
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
                    const matchData = {
                        fechaHora: csvMatch.fechaHora,
                        rivalId: rivalId,
                        nombreRival: csvMatch.nombreRival,
                        nombreEquipo: nombreEquipo,
                        esLocal: csvMatch.esLocal,
                        pabellon: csvMatch.pabellon,
                        alineacion: {},
                        estadisticas: {},
                        puntosEquipo: csvMatch.puntosEquipo,
                        puntosRival: csvMatch.puntosRival,
                        faltasRival: 0,
                        estado: csvMatch.estado
                    };

                    // Create match in Firebase
                    const newRef = await this.competitionService.createMatch(
                        this.ownerUid,
                        this.currentTeamId,
                        this.currentCompeticionId,
                        matchData
                    );

                    // Sync to global matches
                    await this.matchService.syncGlobal(
                        this.ownerUid,
                        this.currentTeamId,
                        this.currentCompeticionId,
                        newRef.key
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
