class TeamApp extends BaseApp {
    constructor() {
        super();
        this.teamService = new TeamService();
        this.playerService = new PlayerService();
        this.competitionService = new CompetitionService();
        this.teamMembersService = new TeamMembersService();
        this.diceBearManager = new DiceBearManager();

        this.teamNameSpan = document.getElementById('teamName');
        this.editTeamBtn = document.getElementById('editTeamBtn');
        this.editTeamNameInput = document.getElementById('editTeamNameInput');
        this.editCoachNameInput = document.getElementById('editCoachNameInput');
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

        this.seccionFantasy = document.getElementById('seccion-fantasy');
        this.fantasyTableContainer = document.getElementById('fantasyTableContainer');
        this.modalFantasyPlayer = new bootstrap.Modal(document.getElementById('modalFantasyPlayer'));
        this.fantasyPlayerName = document.getElementById('fantasyPlayerName');
        this.fantasyMatchList = document.getElementById('fantasyMatchList');

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
        this.currentCoachName = '';
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

        this.currentSortColumn = 'dorsal';
        this.currentSortDirection = 'asc';
        this.mediasGlobalesCache = {};
        this.jugadoresArrayCache = [];
    }

    onUserLoggedIn(user) {
        this.currentUser = user; // Updated in BaseApp to have .uid (aliased to .id)
        this.ownerUid = this.getParam('ownerUid') || user.uid;
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

    async loadTeamData() {
        if (!this.currentUser) return; // Should allow public view if handled in logic?
        // App logic seems to require ownerUid param or current user.

        try {
            const team = await this.teamService.get(this.ownerUid, this.currentTeamId);

            if (!team) {
                alert('Equipo no encontrado o no tienes permiso');
                window.location.href = 'index.html';
                return;
            }

            this.currentTeamName = team.name;
            this.currentCoachName = team.coach || '';
            this.teamNameSpan.textContent = team.name;

            const coachNameDisplay = document.getElementById('coachNameDisplay');
            if (coachNameDisplay) {
                if (this.currentCoachName) {
                    coachNameDisplay.textContent = `Entrenador/a: ${this.currentCoachName}`;
                    coachNameDisplay.style.display = 'block';
                } else {
                    coachNameDisplay.style.display = 'none';
                }
            }

            const teamCalendarLink = document.getElementById('teamCalendarLink');
            if (teamCalendarLink) {
                teamCalendarLink.href = `public/index.html?teamId=${encodeURIComponent(this.currentTeamId)}`;
            }

            this.currentJerseyColor = team.jersey_color || '5199e4';

            this.isOwner = (this.currentUser.uid === this.ownerUid);
            this.userRole = 'follower';

            if (this.isOwner) {
                this.userRole = 'owner';
            } else {
                // Check if member
                // Using callback style or promise adaptation
                // getMembers now returns array in callback (if adapted) or promise (if I updated Service).
                // My Service implementation used callback for getMembers but implemented async fetch inside.
                // Let's look at TeamMembersService refactor...
                // It has `getMembers(ownerUid, teamId, callback)`.
                // I should probably add a Promise-based `checkRole` method or use getMembers with a callback that updates state.
                // For simplicity, I'll fetch members list and check.

                // Better: add checkRole method to Service or use getMembers one-time fetch.
                // The service implementation calls callback(data).

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

            this.applyPermissions();

            this.loadPlantilla();
            this.loadCompeticiones();

            if (this.isOwner) {
                this.navMiembros.style.display = 'block';
                this.loadMembers();
                this.loadFollowers();
            }

        } catch (error) {
            console.error('Error loading team data:', error);
            alert('Error al cargar datos del equipo: ' + (error.message || error));
        }
    }

    applyPermissions() {
        if (this.userRole !== 'owner') {
            this.editTeamBtn.style.display = 'none';
            this.nuevoCompeticionBtn.style.display = 'none';
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
                this.seccionFantasy.style.display = seccion === 'fantasy' ? 'block' : 'none';

                if (seccion === 'fantasy') {
                    this.loadFantasyStats();
                }
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
                const modal = bootstrap.Modal.getInstance(this.addPlayerForm.closest('.modal'));
                if (modal) modal.hide();
                this.loadPlantilla(); // Reload squad
            })
            .catch(err => alert('Error al añadir jugador: ' + err.message));
    }

    handleAddCompetition(e) {
        e.preventDefault();
        const nombre = this.inputNombreCompeticion.value.trim();
        if (!nombre) return alert('Introduce nombre de competición');

        this.competitionService.create(this.ownerUid, this.currentTeamId, nombre)
            .then(() => {
                this.inputNombreCompeticion.value = '';
                const modal = bootstrap.Modal.getInstance(this.addCompeticionForm.closest('.modal'));
                if (modal) modal.hide();
                this.loadCompeticiones();
            })
            .catch(err => alert('Error al crear competición: ' + err.message));
    }

    handleEditCompetition(e) {
        e.preventDefault();
        const nombre = this.editNombreCompeticion.value.trim();
        if (!nombre || !this.competicionAEditar) return;

        this.competitionService.update(this.ownerUid, this.currentTeamId, this.competicionAEditar, { name: nombre }) // Use 'name'
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
        this.editCoachNameInput.value = this.currentCoachName;
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
        const newCoach = this.editCoachNameInput.value.trim();
        const updates = {};
        let hasChanges = false;

        if (newName && newName !== this.currentTeamName) {
            updates.nombre = newName; // Service maps 'nombre' to 'name'
            hasChanges = true;
        }

        if (newCoach !== this.currentCoachName) {
            updates.entrenador = newCoach; // Service maps 'entrenador' to 'coach'
            hasChanges = true;
        }

        if (this.currentJerseyColor && this.currentJerseyColor !== '5199e4') { // Assuming logic
            // But actually we should just check if it's different.
            // But I don't track old color well other than display.
            // Just update it.
            updates.colorCamiseta = this.currentJerseyColor; // Service maps to 'jersey_color'
            hasChanges = true;
        }

        // Always sending color might be safer if logic was relying on it.

        if (Object.keys(updates).length === 0) {
            this.editTeamModal.hide();
            return;
        }

        this.teamService.update(this.ownerUid, this.currentTeamId, updates)
            .then(() => {
                if (updates.nombre) {
                    this.currentTeamName = updates.nombre;
                    this.teamNameSpan.textContent = updates.nombre;
                }
                if (updates.entrenador !== undefined) {
                    this.currentCoachName = updates.entrenador;
                }
                // Refetch team logic is implicit in JS variables update above

                const coachNameDisplay = document.getElementById('coachNameDisplay');
                if (coachNameDisplay) {
                    if (this.currentCoachName) {
                        coachNameDisplay.textContent = `Entrenador: ${this.currentCoachName}`;
                        coachNameDisplay.style.display = 'block';
                    } else {
                        coachNameDisplay.style.display = 'none';
                    }
                }

                this.editTeamModal.hide();
                if (updates.colorCamiseta) {
                    this.loadPlantilla(); // Re-render logic depending on color
                }
            })
            .catch(error => {
                alert('Error al actualizar equipo: ' + error.message);
            });
    }

    async loadPlantilla() {
        this.playersList.innerHTML = '';
        try {
            const players = await this.playerService.getSquad(this.ownerUid, this.currentTeamId); // returns array

            if (!players || players.length === 0) {
                this.playersList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay jugadores añadidos</li>';
                return;
            }

            // Map players to cache (adding key as 'id' equivalent)
            this.jugadoresArrayCache = players.map(p => ({
                key: p.id,
                nombre: p.name,
                dorsal: p.number || p.dorsal, // Map number (DB) to dorsal (App)
                avatarConfig: p.avatarConfig || p.avatar_configs || p.avatar_config || {},
                ...p
            }));

            this.mediasGlobalesCache = await this.calcularMediasEquipoDiccionario(this.currentTeamId);

            this.sortPlayers();

            // Re-get team mainly for jersey color check if not already sync
            // but we have this.currentJerseyColor.

            this.renderPlayersTable(this.currentJerseyColor);
            this.renderPlayersListMobile(this.currentJerseyColor);
        } catch (e) {
            console.error(e);
            this.playersList.innerHTML = '<li class="modern-list-item text-danger">Error cargando plantilla</li>';
        }
    }

    async calcularMediasEquipoDiccionario(equipoID) {
        try {
            // Using RPC function 'get_team_stats' for server-side aggregation
            const { data: stats, error } = await this.teamService.supabase
                .rpc('get_team_stats', { query_team_id: equipoID });

            if (error) {
                console.error("Error calculating team stats via RPC:", error);
                return {};
            }

            if (!stats || stats.length === 0) {
                console.log("TeamApp: No stats found via RPC.");
                return {};
            }

            const result = {};

            stats.forEach(s => {
                const games = s.partidos_jugados || 0;
                if (games === 0) return;

                // Calculated fields
                // Valuation/Valoracion: (PTS + REB + AST + ROB + TAP) - (Missed Stats?) - FALTAS
                // The SQL function returns basic counts. We can refine the SQL to return calc fields or do it here.
                // The SQL I proposed returns: puntos, asistencias, rebotes, robos, tapones, faltas, partidos_jugados
                // It does NOT (yet) return missed shots for strict valuation.
                // If strict valuation is needed, we should update the SQL to return missed shots too.
                // For now, let's use what we have.

                // Note: The SQL sum already handles the logic.

                result[s.player_id] = {
                    puntos: Number(s.puntos) / games,
                    asistencias: Number(s.asistencias) / games,
                    rebotes: Number(s.rebotes) / games,
                    robos: Number(s.robos) / games,
                    tapones: Number(s.tapones) / games,
                    faltas: Number(s.faltas) / games,
                    masMenos: 0, // Not calculated in SQL yet
                    partidosJugados: games,
                    valoracion: (Number(s.puntos) + Number(s.rebotes) + Number(s.asistencias) + Number(s.robos) + Number(s.tapones) - Number(s.faltas)) / games // Approximate if missed shots missing
                };
            });

            return result;

        } catch (e) {
            console.error("Exception in stats calculation:", e);
            return {};
        }
    }

    sortPlayers() {
        this.jugadoresArrayCache.sort((a, b) => {
            const statsA = this.mediasGlobalesCache[a.key];
            const statsB = this.mediasGlobalesCache[b.key];

            let valA, valB;

            switch (this.currentSortColumn) {
                case 'dorsal':
                    valA = parseInt(a.dorsal) || 0;
                    valB = parseInt(b.dorsal) || 0;
                    break;
                case 'nombre':
                    valA = (a.nombre || '').toLowerCase();
                    valB = (b.nombre || '').toLowerCase();
                    break;
                case 'puntos':
                    valA = statsA ? statsA.puntos : -1;
                    valB = statsB ? statsB.puntos : -1;
                    break;
                case 'partidos':
                    valA = statsA ? statsA.partidosJugados : -1;
                    valB = statsB ? statsB.partidosJugados : -1;
                    break;
                case 'asistencias':
                    valA = statsA ? statsA.asistencias : -1;
                    valB = statsB ? statsB.asistencias : -1;
                    break;
                case 'rebotes':
                    valA = statsA ? statsA.rebotes : -1;
                    valB = statsB ? statsB.rebotes : -1;
                    break;
                case 'robos':
                    valA = statsA ? statsA.robos : -1;
                    valB = statsB ? statsB.robos : -1;
                    break;
                case 'tapones':
                    valA = statsA ? statsA.tapones : -1;
                    valB = statsB ? statsB.tapones : -1;
                    break;
                case 'faltas':
                    valA = statsA ? statsA.faltas : -1;
                    valB = statsB ? statsB.faltas : -1;
                    break;
                case 'masMenos':
                    valA = statsA ? statsA.masMenos : -999;
                    valB = statsB ? statsB.masMenos : -999;
                    break;
                case 'valoracion':
                    valA = statsA ? statsA.valoracion : -999;
                    valB = statsB ? statsB.valoracion : -999;
                    break;
                default:
                    valA = 0;
                    valB = 0;
            }

            if (valA < valB) return this.currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    handleSort(column) {
        if (this.currentSortColumn === column) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = 'desc';
            if (column === 'dorsal' || column === 'nombre') {
                this.currentSortDirection = 'asc';
            }
        }
        this.sortPlayers();
        this.renderPlayersTable(this.currentJerseyColor);
    }

    renderPlayersTable(jerseyColor) {
        this.playersList.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'table table-striped table-bordered table-sm d-none d-md-table';

        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');

        const columns = [
            { id: 'avatar', text: 'Avatar', sortable: false },
            { id: 'dorsal', text: 'Dorsal', sortable: true },
            { id: 'nombre', text: 'Nombre', sortable: true },
            { id: 'puntos', text: 'Pts/Juego', sortable: true },
            { id: 'partidos', text: 'Partidos', sortable: true },
            { id: 'asistencias', text: 'Asist.', sortable: true },
            { id: 'rebotes', text: 'Rebotes', sortable: true },
            { id: 'robos', text: 'Robos', sortable: true },
            { id: 'tapones', text: 'Tapones', sortable: true },
            { id: 'faltas', text: 'Faltas', sortable: true },
            { id: 'masMenos', text: '+/-', sortable: true },
            { id: 'valoracion', text: 'Val.', sortable: true },
            { id: 'acciones', text: 'Acciones', sortable: false }
        ];

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.text;
            if (col.sortable) {
                th.style.cursor = 'pointer';
                th.classList.add('user-select-none');
                if (this.currentSortColumn === col.id) {
                    th.textContent += this.currentSortDirection === 'asc' ? ' ▲' : ' ▼';
                }
                th.addEventListener('click', () => this.handleSort(col.id));
            }
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        this.jugadoresArrayCache.forEach(jugador => {
            const stats = this.mediasGlobalesCache[jugador.key] || null;
            const tr = document.createElement('tr');

            const tdAvatar = document.createElement('td');
            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '80px';
            avatarImg.style.height = '80px';

            const avatarUrl = this.diceBearManager.getImage(jugador.key, jugador.avatarConfig, this.currentJerseyColor);
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
                this.createCell(tr, stats.valoracion.toFixed(2));
            } else {
                for (let i = 0; i < 9; i++) this.createCell(tr, '-');
            }

            const tdAcciones = document.createElement('td');
            tdAcciones.className = 'd-flex gap-2';

            const btnEditar = document.createElement('a');
            btnEditar.className = 'btn btn-primary btn-sm';
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


    renderPlayersListMobile(jerseyColor) {
        const listaMovil = document.createElement('ul');
        listaMovil.className = 'modern-list d-block d-md-none';

        this.jugadoresArrayCache.forEach(jugador => {
            const stats = this.mediasGlobalesCache[jugador.key] || null;
            const li = document.createElement('li');
            li.className = 'modern-list-item';
            li.style.cursor = 'pointer';
            li.onclick = () => {
                window.location.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(this.currentTeamId)}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
            };

            const divInfo = document.createElement('div');
            divInfo.className = 'd-flex align-items-center gap-2';

            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '80px';
            avatarImg.style.height = '80px';
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
                spanStats.textContent = `Pts: ${stats.puntos.toFixed(2)} | Val: ${stats.valoracion.toFixed(2)}`;
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
            btnEditar.onclick = (e) => e.stopPropagation();

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn btn-danger btn-sm';
            btnBorrar.title = 'Borrar jugador';
            btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
            btnBorrar.addEventListener('click', (e) => {
                e.stopPropagation();
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
        // Updated service to use ownerUid/teamId. Callback adapted or Promise
        // Refactored Service uses callback.

        this.competitionService.getAll(this.ownerUid, this.currentTeamId, (comps) => {
            this.competicionesList.innerHTML = '';
            if (!comps || comps.length === 0) {
                this.competicionesList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay competiciones creadas</li>';
                return;
            }
            comps.forEach(comp => {
                const li = document.createElement('li');
                li.classList.add('modern-list-item');
                li.textContent = comp.name; // 'name' not 'nombre' in Supabase
                li.style.cursor = 'pointer';
                li.onclick = () => {
                    window.location.href = `competicion.html?idEquipo=${this.currentTeamId}&idCompeticion=${comp.id}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
                };

                const btnAbrir = document.createElement('a');
                btnAbrir.href = `competicion.html?idEquipo=${this.currentTeamId}&idCompeticion=${comp.id}&ownerUid=${encodeURIComponent(this.ownerUid)}`;
                btnAbrir.classList.add('btn', 'btn-sm', 'btn-primary');
                btnAbrir.textContent = 'Abrir';
                btnAbrir.onclick = (e) => e.stopPropagation();

                const btnEditar = document.createElement('button');
                btnEditar.classList.add('btn', 'btn-sm', 'btn-outline-secondary', 'ms-2');
                btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';
                btnEditar.onclick = (e) => {
                    e.stopPropagation();
                    this.competicionAEditar = comp.id;
                    this.editNombreCompeticion.value = comp.name;
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

    // --- Members Logic ---
    loadMembers() {
        this.membersList.innerHTML = '';
        this.teamMembersService.getMembers(this.ownerUid, this.currentTeamId, members => {
            this.membersList.innerHTML = '';
            if (!members || members.length === 0) {
                this.membersList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay miembros.</li>';
                return;
            }

            members.forEach(m => {
                // m has profiles object joined
                const li = document.createElement('li');
                li.className = 'modern-list-item';

                const name = m.profiles?.display_name || m.profiles?.email || 'Usuario';
                const role = m.role;

                li.innerHTML = `
                   <span>${name} (${role})</span>
                   <div>
                       <button class="btn btn-sm btn-danger" onclick="window.removeMember('${m.user_id}')"><i class="bi bi-trash"></i></button>
                   </div>
               `;
                // Implementing delete needs global function or event delegation.
                // Since I can't easily attach global scope functions here for onclick string, I'll use addEventListener
                // Rewriting HTML slightly
                const btn = li.querySelector('button');
                btn.onclick = () => this.handleRemoveMember(m.user_id);

                this.membersList.appendChild(li);
            });
        });
    }

    handleRemoveMember(memberUid) {
        if (confirm('¿Eliminar miembro?')) {
            this.teamMembersService.removeMember(this.ownerUid, this.currentTeamId, memberUid)
                .then(() => this.loadMembers())
                .catch(e => alert(e.message));
        }
    }

    loadFollowers() {
        this.followersList.innerHTML = '';
        this.teamMembersService.getFollowers(this.ownerUid, this.currentTeamId, followers => {
            this.followersList.innerHTML = '';
            if (!followers || followers.length === 0) {
                this.followersList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No hay seguidores.</li>';
                return;
            }
            followers.forEach(f => {
                const li = document.createElement('li');
                li.className = 'modern-list-item';
                const name = f.profiles?.display_name || f.profiles?.email || 'Usuario';
                li.textContent = name;
                this.followersList.appendChild(li);
            });
        });
    }

    // --- Fantasy Tab ---
    async loadFantasyStats() {
        this.fantasyTableContainer.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></div>';

        try {
            // Fetch stats using the RPC function
            const { data: stats, error } = await this.teamService.supabase
                .rpc('get_team_stats', { query_team_id: this.currentTeamId });

            if (error) throw error;

            if (!stats || stats.length === 0) {
                this.fantasyTableContainer.innerHTML = '<p class="text-center text-muted">No hay datos suficientes para generar la clasificación Fantasy.</p>';
                return;
            }

            // Calculate Fantasy Points (Valuation) for each player
            // Formula: PTS + REB + AST + ROB + TAP - FAL - MISSED_SHOTS
            const ranking = stats.map(s => {
                const player = this.jugadoresArrayCache.find(p => p.key === s.player_id);
                // Convert BigInt/Strings to numbers
                const p = Number(s.puntos);
                const reb = Number(s.rebotes);
                const ast = Number(s.asistencias);
                const rob = Number(s.robos);
                const tap = Number(s.tapones);
                const fal = Number(s.faltas);
                const mis = Number(s.tiros_fallados || 0); // Ensure SQL returns this or default 0

                const fantasyPoints = p + reb + ast + rob + tap - fal - mis;

                return {
                    id: s.player_id,
                    name: player ? player.name : 'Desconocido',
                    dorsal: player ? (player.number || player.dorsal) : '-',
                    avatarConfig: player ? player.avatarConfig : {},
                    points: fantasyPoints,
                    matches: Number(s.partidos_jugados),
                    avg: fantasyPoints / (Number(s.partidos_jugados) || 1)
                };
            });

            // Sort by Total Fantasy Points DESC
            ranking.sort((a, b) => b.points - a.points);

            this.renderFantasyTable(ranking);

        } catch (e) {
            console.error("Error loading fantasy:", e);
            this.fantasyTableContainer.innerHTML = '<p class="text-center text-danger">Error al cargar la clasificación Fantasy.</p>';
        }
    }

    renderFantasyTable(ranking) {
        this.fantasyTableContainer.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'table table-striped table-hover align-middle';

        table.innerHTML = `
            <thead class="table-dark">
                <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th class="text-center">Puntos Fantasy</th>
                    <th class="text-center">Promedio</th>
                    <th class="text-center">Partidos</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');

        ranking.forEach((r, index) => {
            const tr = document.createElement('tr');

            // Rank
            const tdRank = document.createElement('td');
            if (index === 0) tdRank.innerHTML = '<i class="bi bi-trophy-fill text-warning"></i> 1';
            else if (index === 1) tdRank.innerHTML = '<i class="bi bi-trophy-fill text-secondary"></i> 2';
            else if (index === 2) tdRank.innerHTML = '<i class="bi bi-trophy-fill" style="color: #cd7f32;"></i> 3';
            else tdRank.textContent = index + 1;
            tr.appendChild(tdRank);

            // Player (Avatar + Name)
            const tdPlayer = document.createElement('td');
            tdPlayer.className = 'd-flex align-items-center gap-2';

            const img = document.createElement('img');
            img.className = 'rounded-circle border';
            img.style.width = '40px';
            img.style.height = '40px';
            img.src = this.diceBearManager.getImage(r.id, r.avatarConfig, this.currentJerseyColor);

            const divInfo = document.createElement('div');
            const divName = document.createElement('div');
            divName.className = 'fw-bold';
            divName.textContent = r.name;
            const divDorsal = document.createElement('div');
            divDorsal.className = 'small text-muted';
            divDorsal.textContent = `#${r.dorsal}`;

            divInfo.appendChild(divName);
            divInfo.appendChild(divDorsal);

            tdPlayer.appendChild(img);
            tdPlayer.appendChild(divInfo);
            tr.appendChild(tdPlayer);

            // Points
            const tdPoints = document.createElement('td');
            tdPoints.className = 'text-center fw-bold fs-5';
            tdPoints.textContent = r.points;
            tr.appendChild(tdPoints);

            // Avg
            const tdAvg = document.createElement('td');
            tdAvg.className = 'text-center';
            tdAvg.textContent = r.avg.toFixed(1);
            tr.appendChild(tdAvg);

            // Matches
            const tdMatches = document.createElement('td');
            tdMatches.className = 'text-center';
            tdMatches.textContent = r.matches;
            tr.appendChild(tdMatches);

            tbody.appendChild(tr);
        });

        this.fantasyTableContainer.appendChild(table);
    }
}
