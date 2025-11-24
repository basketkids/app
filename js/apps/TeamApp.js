class TeamApp extends BaseApp {
    constructor() {
        super();
        this.teamService = new TeamService(this.db);
        this.playerService = new PlayerService(this.db);
        this.competitionService = new CompetitionService(this.db);

        this.teamNameSpan = document.getElementById('teamName');
        this.inputJugadorNombre = document.getElementById('inputJugadorNombre');
        this.inputJugadorDorsal = document.getElementById('inputJugadorDorsal');
        this.addPlayerForm = document.getElementById('addPlayerForm');
        this.playersList = document.getElementById('playersList');
        this.selectJerseyColor = document.getElementById('selectJerseyColor');

        this.nuevoCompeticionBtn = document.getElementById('nuevoCompeticionBtn');
        this.competicionesList = document.getElementById('competicionesList');
        this.addCompeticionForm = document.getElementById('addCompeticionForm');
        this.inputNombreCompeticion = document.getElementById('inputNombreCompeticion');

        this.menuEquipo = document.getElementById('menuEquipo');
        this.seccionPlantilla = document.getElementById('seccion-plantilla');
        this.seccionCompeticiones = document.getElementById('seccion-competiciones');

        this.confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        this.nombreJugadorConfirm = document.getElementById('nombreJugadorConfirm');
        this.btnConfirmDelete = document.getElementById('btnConfirmDelete');
        this.jugadorAEliminar = null;

        this.currentTeamId = null;
    }

    onUserLoggedIn(user) {
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
        this.teamService.get(this.currentUser.uid, this.currentTeamId).then(snap => {
            if (!snap.exists()) {
                alert('Equipo no encontrado o no tienes permiso');
                window.location.href = 'index.html';
                return;
            }
            const team = snap.val();
            this.teamNameSpan.textContent = team.nombre;

            // Load jersey color
            if (team.jerseyColor) {
                this.selectJerseyColor.value = team.jerseyColor;
            }

            this.loadPlantilla();
            this.loadCompeticiones();
        });
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

        this.selectJerseyColor.addEventListener('change', () => this.handleJerseyColorChange());
    }

    handleAddPlayer(e) {
        e.preventDefault();
        const nombre = this.inputJugadorNombre.value.trim();
        const dorsal = this.inputJugadorDorsal.value.trim();
        if (!nombre || !dorsal) return alert('Introduce nombre y dorsal');

        this.playerService.add(this.currentUser.uid, this.currentTeamId, nombre, dorsal)
            .then(() => {
                this.inputJugadorNombre.value = '';
                this.inputJugadorDorsal.value = '';
                bootstrap.Modal.getInstance(this.addPlayerForm.closest('.modal')).hide();
                this.loadPlantilla(); // Reload list
            });
    }

    handleAddCompetition(e) {
        e.preventDefault();
        const nombre = this.inputNombreCompeticion.value.trim();
        if (!nombre) return alert('Introduce nombre de competición');

        this.competitionService.create(this.currentUser.uid, this.currentTeamId, nombre)
            .then(() => {
                this.inputNombreCompeticion.value = '';
                bootstrap.Modal.getInstance(this.addCompeticionForm.closest('.modal')).hide();
                this.loadCompeticiones(); // Reload list
            });
    }

    handleDeletePlayer() {
        if (!this.jugadorAEliminar) return;
        this.playerService.delete(this.currentUser.uid, this.currentTeamId, this.jugadorAEliminar)
            .then(() => {
                this.jugadorAEliminar = null;
                this.confirmDeleteModal.hide();
                this.loadPlantilla(); // Reload list
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

    handleJerseyColorChange() {
        const jerseyColor = this.selectJerseyColor.value;
        this.teamService.update(this.currentUser.uid, this.currentTeamId, { jerseyColor })
            .then(() => {
                // Reload plantilla to update avatars with new color
                this.loadPlantilla();
            })
            .catch(error => {
                alert('Error al actualizar color de camiseta: ' + error.message);
            });
    }

    async loadPlantilla() {
        this.playersList.innerHTML = '';
        const jugadoresSnap = await this.playerService.getSquad(this.currentUser.uid, this.currentTeamId);
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

        // Get team jersey color
        const teamSnap = await this.teamService.get(this.currentUser.uid, this.currentTeamId);
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

            // Avatar cell
            const tdAvatar = document.createElement('td');
            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '60px';
            avatarImg.style.height = '60px';

            const avatarUrl = this.getAvatarUrl(jugador.key, jugador.avatarConfig, jerseyColor);
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

            const btnEditar = document.createElement('a');
            btnEditar.className = 'btn btn-primary btn-sm';
            btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(this.currentTeamId)}`;
            btnEditar.title = 'Editar jugador';
            btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn btn-danger btn-sm';
            btnBorrar.title = 'Borrar jugador';
            btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
            btnBorrar.addEventListener('click', () => {
                this.confirmarBorradoJugador(jugador.key, jugador.nombre);
            });

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

    getAvatarUrl(playerId, avatarConfig, teamJerseyColor = '5199e4') {
        // Generate seed with player ID and current date
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const seed = `${playerId}-${currentDate}`;

        const baseUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
        const params = [];

        // Apply user config or defaults
        if (avatarConfig) {
            Object.keys(avatarConfig).forEach(key => {
                // Skip hasFacialHair and hasAccessories as they're handled separately
                if (key === 'hasFacialHair' || key === 'hasAccessories') return;
                params.push(`${key}=${avatarConfig[key]}`);
            });

            // Handle facial hair
            if (avatarConfig.hasFacialHair) {
                params.push('facialHairType=beardLight');
                params.push('facialHairProbability=100');
            }

            // Handle accessories
            if (avatarConfig.hasAccessories) {
                params.push('accessoriesType=round');
                params.push('accessoriesProbability=100');
            }
        } else {
            // Set default neutral values
            params.push('skinColor=ffdbb4'); // Piel clara
            params.push('top=shortFlat'); // Pelo corto plano
            params.push('hairColor=a55728'); // Castaño
            params.push('eyes=default');
            params.push('eyebrows=default');
            params.push('mouth=default');
        }

        // Fixed clothing with team color
        params.push('clothing=shirtScoopNeck');
        params.push(`clothesColor=${teamJerseyColor}`);

        return params.length ? `${baseUrl}&${params.join('&')}` : baseUrl;
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

            // Avatar
            const avatarImg = document.createElement('img');
            avatarImg.className = 'rounded-circle';
            avatarImg.style.width = '60px';
            avatarImg.style.height = '60px';
            const avatarUrl = this.getAvatarUrl(jugador.key, jugador.avatarConfig, jerseyColor);
            avatarImg.src = avatarUrl;
            avatarImg.alt = 'Avatar';
            divInfo.appendChild(avatarImg);

            // Info text
            const divText = document.createElement('div');
            if (stats) {
                divText.innerHTML = `<strong>${jugador.nombre} (#${jugador.dorsal})</strong><br/>Pts: ${stats.puntos.toFixed(2)} | Val: ${stats.valoracionFantasy.toFixed(2)}`;
            } else {
                divText.innerHTML = `<strong>${jugador.nombre} (#${jugador.dorsal})</strong><br/>Sin estadísticas`;
            }
            divInfo.appendChild(divText);

            const divBotones = document.createElement('div');
            const btnEditar = document.createElement('a');
            btnEditar.className = 'btn btn-primary btn-sm me-1';
            btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(this.currentTeamId)}`;
            btnEditar.title = 'Editar jugador';
            btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

            const btnBorrar = document.createElement('button');
            btnBorrar.className = 'btn btn-danger btn-sm';
            btnBorrar.title = 'Borrar jugador';
            btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
            btnBorrar.addEventListener('click', () => {
                this.confirmarBorradoJugador(jugador.key, jugador.nombre);
            });

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
        this.competitionService.getAll(this.currentUser.uid, this.currentTeamId, snapshot => {
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
                btnAbrir.href = `competicion.html?idEquipo=${this.currentTeamId}&idCompeticion=${key}`;
                btnAbrir.classList.add('btn', 'btn-sm', 'btn-primary');
                btnAbrir.textContent = 'Abrir';
                li.appendChild(btnAbrir);

                this.competicionesList.appendChild(li);
            });
        });
    }

    async calcularMediasEquipoDiccionario(equipoID) {
        const competicionesSnap = await this.competitionService.getAll(this.currentUser.uid, equipoID, () => { }).once('value');
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
}
