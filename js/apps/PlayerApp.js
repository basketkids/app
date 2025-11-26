class PlayerApp extends BaseApp {
    constructor() {
        super();
        this.playerService = new PlayerService(this.db);
        this.teamService = new TeamService(this.db);
        this.competitionService = new CompetitionService(this.db);
        this.diceBearManager = new DiceBearManager();

        this.inputNombre = document.getElementById('inputNombre');
        this.inputDorsal = document.getElementById('inputDorsal');
        this.formEditarJugador = document.getElementById('formEditarJugador');
        this.infoEquipo = document.getElementById('infoEquipo');
        this.statsTotales = document.getElementById('statsTotales');

        // Avatar elements
        this.avatarPreview = document.getElementById('avatarPreview');
        this.selects = {
            skinColor: document.getElementById('selectSkinColor'),
            top: document.getElementById('selectTop'),
            hairColor: document.getElementById('selectHairColor'),
            eyes: document.getElementById('selectEyes'),
            eyebrows: document.getElementById('selectEyebrow'),
            mouth: document.getElementById('selectMouth')
        };
        this.checkFacialHair = document.getElementById('checkFacialHair');
        this.checkAccessories = document.getElementById('checkAccessories');

        this.currentTeamId = null;
        this.jugadorId = null;
        this.avatarConfig = {};
        this.teamJerseyColor = '5199e4'; // Default blue

    }

    onUserLoggedIn(user) {
        this.initAvatarEditor();
        this.loadParamsUrl();
    }

    initAvatarEditor() {
        this.diceBearManager.initEditor({
            selects: this.selects,
            checkFacialHair: this.checkFacialHair,
            checkAccessories: this.checkAccessories
        }, () => this.updateAvatarPreview());
    }

    updateAvatarPreview() {
        const config = this.diceBearManager.getObject();
        this.avatarConfig = config;

        // Generate seed with player ID and current date
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const seed = `${this.jugadorId}-${currentDate}`;

        const url = this.diceBearManager.getImage(seed, config, this.teamJerseyColor);
        this.avatarPreview.src = url;
    }

    loadParamsUrl() {
        const idJugador = this.getParam('idJugador');
        const idEquipo = this.getParam('idEquipo');

        if (!idJugador || !idEquipo) {
            alert('Faltan parámetros para cargar jugador');
            window.location.href = 'index.html';
            return;
        }
        this.jugadorId = idJugador;
        this.currentTeamId = idEquipo;

        this.cargarDatosJugador();
        this.cargarInfoEquipo();
        this.cargarEstadisticasTotales();
        this.cargarColorCamisetaEquipo();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.formEditarJugador.addEventListener('submit', e => this.guardarCambiosJugador(e));
    }

    cargarColorCamisetaEquipo() {
        this.teamService.get(this.currentUser.uid, this.currentTeamId)
            .then(snap => {
                if (snap.exists() && snap.val().jerseyColor) {
                    this.teamJerseyColor = snap.val().jerseyColor;
                    this.updateAvatarPreview();
                }
            })
            .catch(console.error);
    }

    cargarDatosJugador() {
        this.playerService.get(this.currentUser.uid, this.currentTeamId, this.jugadorId)
            .then(snap => {
                if (snap.exists()) {
                    const data = snap.val();
                    this.inputNombre.value = data.nombre || '';
                    this.inputDorsal.value = data.dorsal || '';

                    // Load avatar config or set defaults
                    this.diceBearManager.setCharacter(data.avatarConfig);
                    this.avatarConfig = this.diceBearManager.getObject();
                    this.updateAvatarPreview();
                } else {
                    alert('Jugador no encontrado');
                    window.location.href = 'index.html';
                }
            })
            .catch(console.error);
    }

    cargarInfoEquipo() {
        this.teamService.getName(this.currentUser.uid, this.currentTeamId)
            .then(snap => {
                const nombreEquipo = snap.exists() ? snap.val() : 'Equipo desconocido';
                this.competitionService.getAll(this.currentUser.uid, this.currentTeamId, () => { }).once('value').then(cSnap => {
                    let competiciones = [];
                    if (cSnap.exists()) {
                        competiciones = Object.values(cSnap.val()).map(c => c.nombre || 'Nombre desconocido');
                    }
                    this.infoEquipo.innerHTML = `
                        <p><strong>Equipo:</strong> ${nombreEquipo}</p>
                        <p><strong>Competiciones:</strong> ${competiciones.join(', ') || 'Sin competiciones'}</p>
                    `;
                });
            })
            .catch(console.error);
    }

    async cargarEstadisticasTotales() {
        try {
            const totales = {
                partidos: 0, puntos: 0, rebotes: 0, asistencias: 0, faltas: 0, tapones: 0, robos: 0
            };

            const competicionesSnap = await this.competitionService.getAll(this.currentUser.uid, this.currentTeamId, () => { }).once('value');
            if (!competicionesSnap.exists()) {
                this.mostrarEstadisticas(totales);
                return;
            }

            const competiciones = competicionesSnap.val();

            for (const competicionId in competiciones) {
                const partidosSnap = await this.competitionService.getMatches(this.currentUser.uid, this.currentTeamId, competicionId, () => { }).once('value');
                if (!partidosSnap.exists()) continue;

                const partidos = partidosSnap.val();

                for (const partidoId in partidos) {
                    const statsSnap = await this.db.ref(`usuarios/${this.currentUser.uid}/equipos/${this.currentTeamId}/competiciones/${competicionId}/partidos/${partidoId}/estadisticasJugadores/${this.jugadorId}`).once('value');
                    if (statsSnap.exists()) {
                        totales.partidos++;
                        const stats = statsSnap.val();
                        totales.puntos += stats.puntos || 0;
                        totales.rebotes += stats.rebotes || 0;
                        totales.asistencias += stats.asistencias || 0;
                        totales.faltas += stats.faltas || 0;
                        totales.tapones += stats.tapones || 0;
                        totales.robos += stats.robos || 0;
                    }
                }
            }

            this.mostrarEstadisticas(totales);
        } catch (error) {
            console.error('Error cargando estadísticas totales:', error);
        }
    }

    mostrarEstadisticas(totales) {
        const partidos = totales.partidos || 1;
        const promedio = {
            puntos: (totales.puntos / partidos).toFixed(2),
            rebotes: (totales.rebotes / partidos).toFixed(2),
            asistencias: (totales.asistencias / partidos).toFixed(2),
            faltas: (totales.faltas / partidos).toFixed(2),
            tapones: (totales.tapones / partidos).toFixed(2),
            robos: (totales.robos / partidos).toFixed(2)
        };

        this.statsTotales.innerHTML = `
            <h5>Totales</h5>
            <table class="table table-bordered table-sm mb-4">
                <thead>
                    <tr>
                        <th>Estadística</th>
                        <th>Total</th>
                        <th>Promedio</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Partidos jugados</td><td>${totales.partidos}</td><td>${totales.partidos}</td></tr>
                    <tr><td>Puntos</td><td>${totales.puntos}</td><td>${promedio.puntos}</td></tr>
                    <tr><td>Rebotes</td><td>${totales.rebotes}</td><td>${promedio.rebotes}</td></tr>
                    <tr><td>Asistencias</td><td>${totales.asistencias}</td><td>${promedio.asistencias}</td></tr>
                    <tr><td>Faltas</td><td>${totales.faltas}</td><td>${promedio.faltas}</td></tr>
                    <tr><td>Tapones</td><td>${totales.tapones}</td><td>${promedio.tapones}</td></tr>
                    <tr><td>Robos</td><td>${totales.robos}</td><td>${promedio.robos}</td></tr>
                </tbody>
            </table>
        `;
    }

    guardarCambiosJugador(e) {
        e.preventDefault();
        const nuevoNombre = this.inputNombre.value.trim();
        const nuevoDorsal = parseInt(this.inputDorsal.value);
        if (!nuevoNombre || !nuevoDorsal) {
            alert('Por favor completa todos los campos');
            return;
        }

        // Update avatar config before saving
        this.updateAvatarPreview();

        const data = {
            nombre: nuevoNombre,
            dorsal: nuevoDorsal,
            avatarConfig: this.avatarConfig
        };

        console.log('Guardando avatar config:', this.avatarConfig);

        this.playerService.update(this.currentUser.uid, this.currentTeamId, this.jugadorId, data)
            .then(() => alert('Datos actualizados correctamente'))
            .catch(err => {
                alert('Error al actualizar: ' + err.message);
                console.error(err);
            });
    }
}
