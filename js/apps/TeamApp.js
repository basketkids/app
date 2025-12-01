class TeamApp extends BaseApp {
    constructor() {
        super();
        this.teamService = new TeamService(this.db);
        this.playerService = new PlayerService(this.db);
        this.competitionService = new CompetitionService(this.db);
        this.teamMembersService = new TeamMembersService(this.db);
        this.diceBearManager = new DiceBearManager();

        this.teamNameSpan = document.getElementById('teamName');
        this.editTeamBtn = document.getElementById('editTeamBtn');
        this.editTeamNameInput = document.getElementById('editTeamNameInput');
        this.modalColorPalette = document.getElementById('modalColorPalette');
        this.saveTeamBtn = document.getElementById('saveTeamBtn');

        this.inputJugadorNombre = document.getElementById('inputJugadorNombre');
        this.inputJugadorDorsal = document.getElementById('inputJugadorDorsal');
        this.addPlayerForm = document.getElementById('addPlayerForm');
        this.playersList = document.getElementById('playersList');

        this.nuevoCompeticionBtn = document.getElementById('nuevoCompeticionBtn');
        this.competicionesList = document.getElementById('competicionesList');
        this.addCompeticionForm = document.getElementById('addCompeticionForm');
        this.inputNombreCompeticion = document.getElementById('inputNombreCompeticion');

        this.menuEquipo = document.getElementById('menuEquipo');
        this.seccionPlantilla = document.getElementById('seccion-plantilla');
        this.seccionCompeticiones = document.getElementById('seccion-competiciones');
        this.seccionMiembros = document.getElementById('seccion-miembros');
        this.navMiembros = document.getElementById('navMiembros');
        this.membersList = document.getElementById('membersList');
        this.followersList = document.getElementById('followersList');

        this.confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        this.editTeamModal = new bootstrap.Modal(document.getElementById('editTeamModal'));
        this.nombreJugadorConfirm = document.getElementById('nombreJugadorConfirm');
        this.btnConfirmDelete = document.getElementById('btnConfirmDelete');
        this.jugadorAEliminar = null;

        this.editCompeticionModal = new bootstrap.Modal(document.getElementById('editCompeticionModal'));
        this.editCompeticionForm = document.getElementById('editCompeticionForm');
        this.editNombreCompeticion = document.getElementById('editNombreCompeticion');
        this.competicionAEditar = null;

        this.currentTeamId = null;
        this.currentTeamName = '';
        this.currentJerseyColor = '5199e4';

        this.colors = [
            { value: '262e33', name: 'Negro' },
            { value: '65c9ff', name: 'Azul Claro' },
            { value: '5199e4', name: 'Azul' },
            { value: '25557c', name: 'Azul Oscuro' },
            { value: 'e6e6e6', name: 'Gris Claro' },
            { value: '929598', name: 'Gris' },
            { value: '3c4f5c', name: 'Gris Oscuro' },
            { value: 'b1e2ff', name: 'Celeste' },
            { value: 'a7ffc4', name: 'Verde' },
            { value: 'ffafb9', name: 'Rosa' },
            { value: 'ffffb1', name: 'Amarillo' },
            { value: 'ff488e', name: 'Rosa Fuerte' },
            { value: 'ff5c5c', name: 'Rojo' },
            { value: 'ffffff', name: 'Blanco' }
        ];
    }

    onUserLoggedIn(user) {
        this.currentUser = user;
        this.ownerUid = this.getParam('ownerUid') || user.uid; // Get owner from URL or default to current user
        this.loadTeamFromUrl();
        this.setupEventListeners();
    }

    loadTeamFromUrl() {
        const id = this.getParam('idEquipo');
        if (!id) {
            alert('No se especificó equipo');
            window.location.href = 'index.html';
            return;
        }
        this.currentTeamId = id;
        this.loadTeamData();
    }

    loadTeamData() {
        if (!this.currentUser || !this.currentUser.uid) {
            console.error('User not authenticated');
            alert('Error: Usuario no autenticado. Por favor, recarga la página.');
            return;
        }

        // Use this.ownerUid instead of this.currentUser.uid
        this.teamService.get(this.ownerUid, this.currentTeamId).then(async snap => {
            if (!snap.exists()) {
                alert('Equipo no encontrado o no tienes permiso');
                window.location.href = 'index.html';
                return;
            }
            const team = snap.val();
            this.currentTeamName = team.nombre;
            this.teamNameSpan.textContent = team.nombre;

            const teamCalendarLink = document.getElementById('teamCalendarLink');
            if (teamCalendarLink) {
                teamCalendarLink.href = `public/index.html?teamId=${encodeURIComponent(this.currentTeamId)}`;
            }

            this.currentJerseyColor = team.jerseyColor || '5199e4';

            // Check permissions
            this.isOwner = (this.currentUser.uid === this.ownerUid);
            this.userRole = 'follower'; // Default

            if (this.isOwner) {
                this.userRole = 'owner';
            } else {
                // Check member role
                const memberSnap = await this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId, () => { }).once('value');
                if (memberSnap.exists() && memberSnap.hasChild(this.currentUser.uid)) {
                    this.userRole = memberSnap.child(this.currentUser.uid).val().role;
                }
            }

            this.applyPermissions();

            this.loadPlantilla();
            this.loadCompeticiones();

            if (this.isOwner) {
                this.navMiembros.style.display = 'block';
                this.loadMembers();
                this.loadFollowers();
            }

        }).catch(error => {
            console.error('Error loading team data:', error);
            alert('Error al cargar datos del equipo: ' + error.message);
        });
    }

    applyPermissions() {
        // Hide/Show elements based on role
        if (this.userRole !== 'owner') {
            this.editTeamBtn.style.display = 'none';
            this.nuevoCompeticionBtn.style.display = 'none';
            // Hide add player button?
            // "Jugador: ... modificar su nombre y avatar". Can they add players? Probably not.
            // "Estadista: ... editar todo lo que tiene que ver con todos los partidos".
            // Assuming only Owner adds players/competitions for now.
            const addPlayerBtn = document.querySelector('[data-bs-target="#addPlayerModal"]');
            if (addPlayerBtn) addPlayerBtn.style.display = 'none';
        } else {
            const addPlayerBtn = document.querySelector('[data-bs-target="#addPlayerModal"]');
            if (addPlayerBtn) addPlayerBtn.style.display = 'block';
        }
    }

    setupEventListeners() {
        this.menuEquipo.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const seccion = e.target.getAttribute('data-seccion');
                this.menuEquipo.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                e.target.classList.add('active');
                this.seccionPlantilla.style.display = seccion === 'plantilla' ? 'block' : 'none';
                this.seccionCompeticiones.style.display = seccion === 'competiciones' ? 'block' : 'none';
                this.seccionMiembros.style.display = seccion === 'miembros' ? 'block' : 'none';
            });
        });

        this.addPlayerForm.addEventListener('submit', e => this.handleAddPlayer(e));

        this.nuevoCompeticionBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('addCompeticionModal'));
            this.inputNombreCompeticion.value = '';
            modal.show();
        });

        this.addCompeticionForm.addEventListener('submit', e => this.handleAddCompetition(e));

        this.btnConfirmDelete.addEventListener('click', () => this.handleDeletePlayer());

        this.editTeamBtn.addEventListener('click', () => this.openEditTeamModal());

        this.saveTeamBtn.addEventListener('click', () => this.handleSaveTeam());

        this.editCompeticionForm.addEventListener('submit', e => this.handleEditCompetition(e));
    }

    handleAddPlayer(e) {
        e.preventDefault();
        const nombre = this.inputJugadorNombre.value.trim();
        const dorsal = this.inputJugadorDorsal.value.trim();

        if (!nombre) return alert('Introduce nombre');
        if (!dorsal) return alert('Introduce dorsal');

        const validDorsalRegex = /^(0|00|[1-9][0-9]?)$/;
        if (!validDorsalRegex.test(dorsal)) {
            return alert('Dorsal inválido. Debe ser 0, 00 o un número entre 1 y 99.');
        }

        this.playerService.add(this.ownerUid, this.currentTeamId, nombre, dorsal)
            .then(() => {
                this.inputJugadorNombre.value = '';
                this.inputJugadorDorsal.value = '';
                bootstrap.Modal.getInstance(this.addPlayerForm.closest('.modal')).hide();
                this.loadPlantilla();
            });
    }

    handleAddCompetition(e) {
        e.preventDefault();
        const nombre = this.inputNombreCompeticion.value.trim();
        if (!nombre) return alert('Introduce nombre de competición');

        this.competitionService.create(this.ownerUid, this.currentTeamId, nombre)
            .then(() => {
                this.inputNombreCompeticion.value = '';
                bootstrap.Modal.getInstance(this.addCompeticionForm.closest('.modal')).hide();
                this.loadCompeticiones();
            });
    }

    handleEditCompetition(e) {
        e.preventDefault();
        const nombre = this.editNombreCompeticion.value.trim();
        if (!nombre || !this.competicionAEditar) return;

        this.competitionService.update(this.ownerUid, this.currentTeamId, this.competicionAEditar, { nombre })
            .then(() => {
                this.editCompeticionModal.hide();
                this.competicionAEditar = null;
                this.loadCompeticiones();
            })
            .catch(err => alert('Error al actualizar: ' + err.message));
    }

    handleDeletePlayer() {
        if (!this.jugadorAEliminar) return;
        this.playerService.delete(this.ownerUid, this.currentTeamId, this.jugadorAEliminar)
            .then(() => {
                this.jugadorAEliminar = null;
                this.confirmDeleteModal.hide();
                this.loadPlantilla();
            })
            .catch(error => {
                alert('Error al borrar jugador: ' + error.message);
            });
    }

    confirmarBorradoJugador(key, nombre) {
        this.jugadorAEliminar = key;
        this.nombreJugadorConfirm.textContent = nombre;
        this.confirmDeleteModal.show();
    }

    openEditTeamModal() {
        this.editTeamNameInput.value = this.currentTeamName;
        this.renderModalColorPalette();

        const fixMatchesLink = document.getElementById('fixMatchesLink');
        if (fixMatchesLink) {
            fixMatchesLink.href = `fix_matches.html?idEquipo=${encodeURIComponent(this.currentTeamId)}`;
        }

        this.editTeamModal.show();
    }

    renderModalColorPalette() {
        this.modalColorPalette.innerHTML = '';
        this.colors.forEach(color => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'btn p-0 position-relative';
            swatch.style.width = '50px';
            swatch.style.height = '50px';
            swatch.style.backgroundColor = `#${color.value}`;
            swatch.style.border = this.currentJerseyColor === color.value ? '3px solid #2B2B2B' : '2px solid #dee2e6';
            swatch.style.borderRadius = '8px';
            swatch.style.cursor = 'pointer';
            swatch.title = color.name;

            if (this.currentJerseyColor === color.value) {
                const check = document.createElement('i');
                check.className = 'bi bi-check-lg position-absolute top-50 start-50 translate-middle';
                check.style.fontSize = '1.5rem';
                check.style.color = color.value === 'ffffff' || color.value === 'ffffb1' ? '#000' : '#fff';
                check.style.fontWeight = 'bold';
                swatch.appendChild(check);
            }

            swatch.addEventListener('click', () => {
                this.currentJerseyColor = color.value;
                this.renderModalColorPalette();
            });
            this.modalColorPalette.appendChild(swatch);
        });
    }

    handleSaveTeam() {
        const newName = this.editTeamNameInput.value.trim();
        const updates = {};
        let hasChanges = false;

        if (newName && newName !== this.currentTeamName) {
            updates.nombre = newName;
            hasChanges = true;
        }

        if (this.currentJerseyColor) {
            updates.jerseyColor = this.currentJerseyColor;
            hasChanges = true;
        }

        if (!hasChanges) {
            this.editTeamModal.hide();
            return;
        }

        this.teamService.update(this.ownerUid, this.currentTeamId, updates)
            .then(() => {
                if (updates.nombre) {
                    this.currentTeamName = updates.nombre;
                    this.teamNameSpan.textContent = updates.nombre;
                }
                this.editTeamModal.hide();
                if (updates.jerseyColor) {
                    this.loadPlantilla();
                }
            })
            .catch(error => {
                alert('Error al actualizar equipo: ' + error.message);
            });
    }

    async loadPlantilla() {
        this.playersList.innerHTML = '';
        const jugadoresSnap = await this.playerService.getSquad(this.ownerUid, this.currentTeamId);
        if (!jugadoresSnap.exists()) {
            this.playersList.innerHTML = '<li class="list-group-item">No hay jugadores añadidos</li>';
            return;
        }

        const jugadoresArray = [];
        jugadoresSnap.forEach(jugadorSnap => {
            const jugador = jugadorSnap.val();
            const key = jugadorSnap.key;
            jugadoresArray.push({ key, ...jugador });
        });

        jugadoresArray.sort((a, b) => (a.dorsal || 0) - (b.dorsal || 0));

        const mediasGlobales = await this.calcularMediasEquipoDiccionario(this.currentTeamId);
        const teamSnap = await this.teamService.get(this.ownerUid, this.currentTeamId);
        const jerseyColor = teamSnap.exists() && teamSnap.val().jerseyColor ? teamSnap.val().jerseyColor : '5199e4';

        this.renderPlayersTable(jugadoresArray, mediasGlobales, jerseyColor);
        this.renderPlayersListMobile(jugadoresArray, mediasGlobales, jerseyColor);
    }

    renderPlayersTable(jugadoresArray, mediasGlobales, jerseyColor) {
        const table = document.createElement('table');
        table.className = 'table table-striped table-bordered table-sm d-none d-md-table';

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        ['Avatar', 'Dorsal', 'Nombre', 'Pts/Juego', 'Partidos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas', '+/-', 'Valoración', 'Acciones'].forEach(thText => {
            const th = document.createElement('th');
            th.textContent = thText;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        jugadoresArray.forEach(jugador => {
            const stats = mediasGlobales[jugador.key] || null;
            const tr = document.createElement('tr');

            const tdAvatar = document.createElement('td');
            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '60px';
            avatarImg.style.height = '60px';

            const avatarUrl = this.diceBearManager.getImage(jugador.key, jugador.avatarConfig, jerseyColor);
            avatarImg.src = avatarUrl;
            avatarImg.alt = 'Avatar';
            tdAvatar.appendChild(avatarImg);
            tr.appendChild(tdAvatar);

            this.createCell(tr, jugador.dorsal || '');
            this.createCell(tr, jugador.nombre || '');

            if (stats) {
                this.createCell(tr, stats.puntos.toFixed(2));
                this.createCell(tr, stats.partidosJugados);
                this.createCell(tr, stats.asistencias.toFixed(2));
                this.createCell(tr, stats.rebotes.toFixed(2));
                this.createCell(tr, stats.robos.toFixed(2));
                this.createCell(tr, stats.tapones.toFixed(2));
                this.createCell(tr, stats.faltas.toFixed(2));
                const mm = stats.masMenos.toFixed(2);
                this.createCell(tr, mm > 0 ? `+${mm}` : mm);
                this.createCell(tr, stats.valoracionFantasy.toFixed(2));
            } else {
                for (let i = 0; i < 9; i++) this.createCell(tr, '-');
            }

            const tdAcciones = document.createElement('td');
            tdAcciones.className = 'd-flex gap-2';

            // Check if user can edit this player
            // Owner: Yes
            // Player: Only if linked to this player
            // Statistician: No? (User says "Estadista: editar partidos")

            let canEdit = (this.userRole === 'owner');
            if (this.userRole === 'player') {
                // Check if linked. I need to know my linkedPlayerId.
                // I should fetch it in loadTeamData or here.
                // For simplicity, I'll allow clicking "Edit", and PlayerApp will enforce permission.
                // Or better, check here.
                // I'll fetch my member data in loadTeamData.
            }

            const btnEditar = document.createElement('a');
            btnEditar.className = 'btn btn-primary btn-sm';
            // Pass ownerUid
            btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(this.currentTeamId)}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
            btnEditar.title = 'Editar jugador';
            btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn btn-danger btn-sm';
            btnBorrar.title = 'Borrar jugador';
            btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
            btnBorrar.addEventListener('click', () => {
                this.confirmarBorradoJugador(jugador.key, jugador.nombre);
            });

            if (this.userRole !== 'owner') {
                btnBorrar.style.display = 'none';
                btnEditar.style.display = 'none';
            }

            tdAcciones.appendChild(btnEditar);
            tdAcciones.appendChild(btnBorrar);
            tr.appendChild(tdAcciones);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        this.playersList.appendChild(table);
    }

    createCell(tr, text) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
    }


    renderPlayersListMobile(jugadoresArray, mediasGlobales, jerseyColor) {
        const listaMovil = document.createElement('ul');
        listaMovil.className = 'list-group d-block d-md-none';

        jugadoresArray.forEach(jugador => {
            const stats = mediasGlobales[jugador.key] || null;
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';

            const divInfo = document.createElement('div');
            divInfo.className = 'd-flex align-items-center gap-2';

            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '60px';
            avatarImg.style.height = '60px';
            const avatarUrl = this.diceBearManager.getImage(jugador.key, jugador.avatarConfig, jerseyColor);
            avatarImg.src = avatarUrl;
            avatarImg.alt = 'Avatar';
            divInfo.appendChild(avatarImg);

            const divText = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = `${jugador.nombre} (#${jugador.dorsal})`;
            divText.appendChild(strong);
            divText.appendChild(document.createElement('br'));

            const spanStats = document.createElement('span');
            if (stats) {
                spanStats.textContent = `Pts: ${stats.puntos.toFixed(2)} | Val: ${stats.valoracionFantasy.toFixed(2)}`;
            } else {
                spanStats.textContent = 'Sin estadísticas';
            }
            divText.appendChild(spanStats);
            divInfo.appendChild(divText);

            const divBotones = document.createElement('div');
            const btnEditar = document.createElement('a');
            btnEditar.className = 'btn btn-primary btn-sm me-1';
            btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(this.currentTeamId)}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
            btnEditar.title = 'Editar jugador';
            btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn btn-danger btn-sm';
            btnBorrar.title = 'Borrar jugador';
            btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
            btnBorrar.addEventListener('click', () => {
                this.confirmarBorradoJugador(jugador.key, jugador.nombre);
            });

            if (this.userRole !== 'owner') {
                btnBorrar.style.display = 'none';
                btnEditar.style.display = 'none';
            }

            divBotones.appendChild(btnEditar);
            divBotones.appendChild(btnBorrar);
            li.appendChild(divInfo);
            li.appendChild(divBotones);
            listaMovil.appendChild(li);
        });

        this.playersList.appendChild(listaMovil);
    }

    loadCompeticiones() {
        this.competicionesList.innerHTML = '';
        this.competitionService.getAll(this.ownerUid, this.currentTeamId, snapshot => { // Use ownerUid
            this.competicionesList.innerHTML = '';
            if (!snapshot.exists()) {
                this.competicionesList.innerHTML = '<li class="list-group-item">No hay competiciones creadas</li>';
                return;
            }
            snapshot.forEach(compSnap => {
                const competicion = compSnap.val();
                const key = compSnap.key;

                const li = document.createElement('li');
                li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
                li.textContent = competicion.nombre;

                const btnAbrir = document.createElement('a');
                // Pass ownerUid
                btnAbrir.href = `competicion.html?idEquipo=${this.currentTeamId}&idCompeticion=${key}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
                btnAbrir.classList.add('btn', 'btn-sm', 'btn-primary');
                btnAbrir.textContent = 'Abrir';

                const btnEditar = document.createElement('button');
                btnEditar.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'ms-2');
                btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';
                btnEditar.onclick = () => {
                    this.competicionAEditar = key;
                    this.editNombreCompeticion.value = competicion.nombre;
                    this.editCompeticionModal.show();
                };

                if (this.userRole !== 'owner') {
                    btnEditar.style.display = 'none';
                }

                const divBtns = document.createElement('div');
                divBtns.appendChild(btnAbrir);
                divBtns.appendChild(btnEditar);

                li.appendChild(divBtns);

                this.competicionesList.appendChild(li);
            });
        });
    }

    async calcularMediasEquipoDiccionario(equipoID) {
        const competicionesSnap = await this.competitionService.getAll(this.ownerUid, equipoID, () => { }).once('value');
        const mediasPorJugador = {};

        competicionesSnap.forEach(compSnap => {
            const partidosSnap = compSnap.child('partidos');
            if (partidosSnap.exists()) {
                partidosSnap.forEach(partidoSnap => {
                    const estadisticasJugadoresSnap = partidoSnap.child('estadisticasJugadores');
                    if (estadisticasJugadoresSnap.exists()) {
                        estadisticasJugadoresSnap.forEach(jugadorSnap => {
                            const jugadorId = jugadorSnap.key;
                            const stats = jugadorSnap.val();
                            if (!mediasPorJugador[jugadorId]) {
                                mediasPorJugador[jugadorId] = {
                                    puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0, partidosJugados: 0
                                };
                            }
                            mediasPorJugador[jugadorId].puntos += stats.puntos || 0;
                            mediasPorJugador[jugadorId].asistencias += stats.asistencias || 0;
                            mediasPorJugador[jugadorId].rebotes += stats.rebotes || 0;
                            mediasPorJugador[jugadorId].robos += stats.robos || 0;
                            mediasPorJugador[jugadorId].tapones += stats.tapones || 0;
                            mediasPorJugador[jugadorId].faltas += stats.faltas || 0;
                            mediasPorJugador[jugadorId].masMenos += stats.masMenos || 0;
                            mediasPorJugador[jugadorId].partidosJugados++;
                        });
                    }
                });
            }
        });

        for (const jugadorId in mediasPorJugador) {
            const acc = mediasPorJugador[jugadorId];
            if (acc.partidosJugados === 0) {
                mediasPorJugador[jugadorId] = null;
                continue;
            }
            mediasPorJugador[jugadorId] = {
                puntos: acc.puntos / acc.partidosJugados,
                asistencias: acc.asistencias / acc.partidosJugados,
                rebotes: acc.rebotes / acc.partidosJugados,
                robos: acc.robos / acc.partidosJugados,
                tapones: acc.tapones / acc.partidosJugados,
                faltas: acc.faltas / acc.partidosJugados,
                masMenos: acc.masMenos / acc.partidosJugados,
                partidosJugados: acc.partidosJugados,
                valoracionFantasy: this.calcularPuntosFantasy({
                    puntos: acc.puntos / acc.partidosJugados,
                    asistencias: acc.asistencias / acc.partidosJugados,
                    rebotes: acc.rebotes / acc.partidosJugados,
                    robos: acc.robos / acc.partidosJugados,
                    tapones: acc.tapones / acc.partidosJugados,
                    faltas: acc.faltas / acc.partidosJugados,
                })
            };
        }
        return mediasPorJugador;
    }

    calcularPuntosFantasy(stats) {
        if (!stats) return 0;
        return (stats.puntos || 0) * 1 +
            (stats.rebotes || 0) * 1 +
            (stats.asistencias || 0) * 2 +
            (stats.tapones || 0) * 3 +
            (stats.robos || 0) * 3 -
            (stats.faltas || 0) * 1;
    }

    // --- Members Management ---

    loadMembers() {
        this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId, async (snap) => {
            if (!snap.exists()) {
                this.membersList.innerHTML = '<li class="list-group-item text-muted">No hay miembros asignados.</li>';
                return;
            }

            const members = snap.val();
            const memberPromises = Object.entries(members).map(async ([uid, data]) => {
                const userSnap = await this.db.ref(`usuarios/${uid}/profile`).once('value');
                const userProfile = userSnap.val() || {};
                return { uid, data, userProfile };
            });

            const membersData = await Promise.all(memberPromises);

            // Render atomically
            this.membersList.innerHTML = '';

            membersData.forEach(({ uid, data, userProfile }) => {
                const name = userProfile.displayName || userProfile.nombre || 'Usuario';

                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                const divInfo = document.createElement('div');

                const divName = document.createElement('div');
                divName.className = 'fw-bold';
                divName.textContent = name;
                divInfo.appendChild(divName);

                const divRole = document.createElement('div');
                divRole.className = 'small text-muted';
                divRole.textContent = this.getRoleName(data.role);
                divInfo.appendChild(divRole);

                if (data.role === 'player' && data.linkedPlayerId) {
                    const badge = document.createElement('div');
                    badge.className = 'badge bg-info text-dark';
                    badge.textContent = 'Jugador Vinculado';
                    divInfo.appendChild(badge);
                }
                li.appendChild(divInfo);

                const divActions = document.createElement('div');
                const btnRemove = document.createElement('button');
                btnRemove.className = 'btn btn-sm btn-outline-danger remove-member-btn';
                btnRemove.dataset.uid = uid;
                btnRemove.innerHTML = '<i class="bi bi-trash"></i>'; // Icon is safe
                divActions.appendChild(btnRemove);
                li.appendChild(divActions);

                li.querySelector('.remove-member-btn').addEventListener('click', () => {
                    if (confirm(`¿Quitar a ${name} del equipo?`)) {
                        this.teamMembersService.removeMember(this.ownerUid, this.currentTeamId, uid);
                    }
                });

                this.membersList.appendChild(li);
            });
        });
    }

    loadFollowers() {
        this.teamMembersService.getFollowers(this.ownerUid, this.currentTeamId, async (snap) => {
            this.followersList.innerHTML = '';
            if (!snap.exists()) {
                this.followersList.innerHTML = '<li class="list-group-item text-muted">No hay seguidores.</li>';
                return;
            }

            const followers = snap.val();
            // Filter out existing members
            const membersSnap = await this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId, () => { }).once('value');
            const members = membersSnap.val() || {};

            for (const uid of Object.keys(followers)) {
                if (members[uid]) continue; // Skip if already a member

                const userSnap = await this.db.ref(`usuarios/${uid}/profile`).once('value');
                const userProfile = userSnap.val() || {};
                const name = userProfile.displayName || userProfile.nombre || 'Usuario';

                const li = document.createElement('li');
                li.className = 'list-group-item';
                const divInfo = document.createElement('div');
                divInfo.className = 'd-flex justify-content-between align-items-center mb-2';
                const spanName = document.createElement('span');
                spanName.className = 'fw-bold';
                spanName.textContent = name;
                divInfo.appendChild(spanName);
                li.appendChild(divInfo);

                const divActions = document.createElement('div');
                divActions.className = 'd-flex gap-2';

                const btnStat = document.createElement('button');
                btnStat.className = 'btn btn-sm btn-outline-primary promote-btn';
                btnStat.dataset.uid = uid;
                btnStat.dataset.role = 'statistician';
                btnStat.textContent = 'Hacer Estadista';
                divActions.appendChild(btnStat);

                const btnPlayer = document.createElement('button');
                btnPlayer.className = 'btn btn-sm btn-outline-success promote-btn';
                btnPlayer.dataset.uid = uid;
                btnPlayer.dataset.role = 'player';
                btnPlayer.textContent = 'Hacer Jugador';
                divActions.appendChild(btnPlayer);

                li.appendChild(divActions);

                li.querySelectorAll('.promote-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const role = e.target.dataset.role;
                        const uid = e.target.dataset.uid;

                        if (role === 'player') {
                            // Need to link to a player
                            this.showLinkPlayerModal(uid, name);
                        } else {
                            if (confirm(`¿Promover a ${name} a Estadista?`)) {
                                await this.teamMembersService.addMember(this.ownerUid, this.currentTeamId, uid, role);
                            }
                        }
                    });
                });

                this.followersList.appendChild(li);
            }
        });
    }

    async showLinkPlayerModal(userUid, userName) {
        // Simple prompt for now, or better, a dynamic modal. 
        // Since I can't easily add a new modal HTML right now without editing equipo.html again, 
        // I'll use a prompt with the list of players or just pick the first one? No, that's bad.
        // I'll use a standard JS prompt for Player Number (Dorsal) to link?
        // Or better, I'll fetch players and show a simple selection using a standard confirm/prompt flow is hard.
        // I'll create a temporary modal programmatically.

        const playersSnap = await this.playerService.getSquad(this.ownerUid, this.currentTeamId);
        if (!playersSnap.exists()) {
            alert('No hay jugadores en la plantilla para vincular.');
            return;
        }

        let message = `Selecciona el número (Dorsal) del jugador para vincular a ${userName}:\n\n`;
        const players = [];
        playersSnap.forEach(p => {
            const val = p.val();
            players.push({ key: p.key, ...val });
            message += `${val.dorsal}: ${val.nombre}\n`;
        });

        const dorsal = prompt(message);
        if (dorsal) {
            const dorsalClean = dorsal.trim();
            // Use loose equality or string comparison to handle "7" vs 7
            const player = players.find(p => String(p.dorsal) === dorsalClean);
            if (player) {
                await this.teamMembersService.addMember(this.ownerUid, this.currentTeamId, userUid, 'player');
                await this.teamMembersService.linkPlayer(this.ownerUid, this.currentTeamId, userUid, player.key);
                alert(`${userName} vinculado a ${player.nombre}`);
            } else {
                alert('Dorsal no encontrado.');
            }
        }
    }

    getRoleName(role) {
        switch (role) {
            case 'statistician': return 'Estadista';
            case 'player': return 'Jugador';
            case 'follower': return 'Seguidor';
            default: return role;
        }
    }
}
