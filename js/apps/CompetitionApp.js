class CompetitionApp extends BaseApp {
    constructor() {
        super();
        this.competitionService = new CompetitionService(this.db);
        this.matchService = new MatchService(this.db);

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

        this.currentTeamId = null;
        this.currentCompeticionId = null;
        this.elementoABorrar = null;
    }

    onUserLoggedIn(user) {
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
        this.loadCompeticionData();
        this.setupEventListeners();
    }

    loadCompeticionData() {
        this.competitionService.get(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId)
            .then(snap => {
                if (!snap.exists()) {
                    alert('Competición no encontrada o sin permiso');
                    window.location.href = `equipo.html?id=${this.currentTeamId}`;
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
    }

    handleAddRival(e) {
        e.preventDefault();
        const nombre = this.inputNombreRival.value.trim();
        if (!nombre) return alert('Introduce nombre de rival');

        this.competitionService.addRival(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, nombre)
            .then(() => {
                this.inputNombreRival.value = '';
                const modal = bootstrap.Modal.getOrCreateInstance(this.addRivalForm.closest('.modal'));
                modal.hide();
            });
    }

    loadRivales() {
        this.rivalesList.innerHTML = '';
        this.competitionService.getRivals(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, snapshot => {
            this.rivalesList.innerHTML = '';
            this.inputRivalSelect.innerHTML = '<option value="">Selecciona rival</option>';

            if (!snapshot.exists()) {
                this.rivalesList.innerHTML = '<li class="list-group-item">No hay rivales añadidos</li>';
                return;
            }

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

                const btnBorrar = document.createElement('button');
                btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
                btnBorrar.title = 'Borrar rival';
                btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
                btnBorrar.onclick = () => {
                    this.elementoABorrar = { tipo: 'rival', id };
                    this.confirmDeleteModal.show();
                };
                li.appendChild(btnBorrar);

                this.rivalesList.appendChild(li);
            });
        });
    }

    loadPartidos() {
        this.partidosList.innerHTML = '';
        this.competitionService.getMatches(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, snapshot => {
            this.partidosList.innerHTML = '';
            if (!snapshot.exists()) {
                this.partidosList.innerHTML = '<li class="list-group-item">No hay partidos añadidos</li>';
                return;
            }

            this.db.ref(`usuarios/${this.currentUser.uid}/equipos/${this.currentTeamId}/nombre`).once('value').then(nombreSnap => {
                const nombreEquipo = nombreSnap.exists() ? nombreSnap.val() : 'Mi equipo';

                snapshot.forEach(partidoSnap => {
                    const partido = partidoSnap.val();
                    const id = partidoSnap.key;
                    this.renderMatchItem(partido, id, nombreEquipo);
                });
            });
        });
    }

    renderMatchItem(partido, id, nombreEquipo) {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center', 'flex-column', 'text-start');

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
        li.appendChild(divMarcador);

        const botonesContainer = document.createElement('div');
        botonesContainer.classList.add('d-flex', 'gap-2', 'mt-2', 'justify-content-end', 'w-100');

        const btnGestionar = document.createElement('a');
        btnGestionar.href = `partidonew.html?idEquipo=${this.currentTeamId}&idCompeticion=${this.currentCompeticionId}&idPartido=${id}`;
        btnGestionar.classList.add('btn', 'btn-sm', 'btn-warning');
        btnGestionar.title = 'Gestionar partido';
        btnGestionar.innerHTML = '<i class="bi bi-pencil-fill"></i>';
        botonesContainer.appendChild(btnGestionar);

        const btnBorrar = document.createElement('button');
        btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
        btnBorrar.title = 'Borrar partido';
        btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
        btnBorrar.onclick = () => {
            this.elementoABorrar = { tipo: 'partido', id };
            this.confirmDeleteModal.show();
        };
        botonesContainer.appendChild(btnBorrar);

        li.appendChild(botonesContainer);
        this.partidosList.appendChild(li);
    }

    handleDelete() {
        if (!this.elementoABorrar) return;

        if (this.elementoABorrar.tipo === 'rival') {
            this.competitionService.deleteRival(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, this.elementoABorrar.id)
                .then(() => {
                    this.elementoABorrar = null;
                    this.confirmDeleteModal.hide();
                }).catch(err => alert('Error al borrar rival: ' + err.message));
        } else if (this.elementoABorrar.tipo === 'partido') {
            this.competitionService.deleteMatch(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, this.elementoABorrar.id)
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

        this.db.ref(`usuarios/${this.currentUser.uid}/equipos/${this.currentTeamId}/nombre`).once('value').then(equipoSnap => {
            const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
            if (!fechaHoraStr || !rivalId || !pabellon) {
                alert('Rellena todos los campos para crear el partido');
                return;
            }

            this.competitionService.getMatchRival(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, rivalId)
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

                    this.competitionService.createMatch(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, matchData)
                        .then((newRef) => {
                            const partidoId = newRef.key;
                            this.matchService.syncGlobal(this.currentUser.uid, this.currentTeamId, this.currentCompeticionId, partidoId);

                            this.inputFechaHora.value = '';
                            this.inputRivalSelect.value = '';
                            this.inputLocalVisitante.value = 'local';
                            this.inputPabellon.value = '';
                            const modal = bootstrap.Modal.getOrCreateInstance(this.addPartidoForm.closest('.modal'));
                            modal.hide();
                        });
                });
        });
    }
}
