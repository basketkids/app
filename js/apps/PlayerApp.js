class PlayerApp extends BaseApp {
    constructor() {
        super();
        this.playerService = new PlayerService(this.db);
        this.teamService = new TeamService(this.db);
        this.competitionService = new CompetitionService(this.db);

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

        this.avatarOptions = {
            skinColor: [
                { value: "614335", name: "Moreno Oscuro" },
                { value: "d08b5b", name: "Moreno" },
                { value: "ae5d29", name: "Moreno Claro" },
                { value: "edb98a", name: "Beige" },
                { value: "ffdbb4", name: "Claro" },
                { value: "fd9841", name: "Naranja" },
                { value: "f8d25c", name: "Amarillo" }
            ],
            top: ["hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04", "bob", "bun", "curly", "curvy", "dreads", "frida", "fro", "froBand", "longButNotTooLong", "miaWallace", "shavedSides", "straight02", "straight01", "straightAndStrand", "dreads01", "dreads02", "frizzle", "shaggy", "shaggyMullet", "shortCurly", "shortFlat", "shortRound", "shortWaved", "sides", "theCaesar", "theCaesarAndSidePart", "bigHair"],
            hairColor: [
                { value: "a55728", name: "Castaño" },
                { value: "2c1b18", name: "Negro" },
                { value: "b58143", name: "Castaño Claro" },
                { value: "d6b370", name: "Rubio Oscuro" },
                { value: "724133", name: "Marrón" },
                { value: "4a312c", name: "Marrón Oscuro" },
                { value: "f59797", name: "Rosa" },
                { value: "ecdcbf", name: "Platino" },
                { value: "c93305", name: "Pelirrojo" },
                { value: "e8e1e1", name: "Gris/Blanco" }
            ],
            eyes: ["closed", "cry", "default", "eyeRoll", "happy", "hearts", "side", "squint", "surprised", "winkWacky", "wink", "xDizzy"],
            eyebrows: ["angryNatural", "defaultNatural", "flatNatural", "frownNatural", "raisedExcitedNatural", "sadConcernedNatural", "unibrowNatural", "upDownNatural", "angry", "default", "raisedExcited", "sadConcerned", "upDown"],
            mouth: ["concerned", "default", "disbelief", "eating", "grimace", "sad", "screamOpen", "serious", "smile", "tongue", "twinkle", "vomit"]
        };
    }

    onUserLoggedIn(user) {
        this.initAvatarEditor();
        this.loadParamsUrl();
    }

    initAvatarEditor() {
        Object.keys(this.selects).forEach(key => {
            const select = this.selects[key];
            if (!select) return;

            this.avatarOptions[key].forEach(item => {
                const option = document.createElement('option');

                // Check if item is an object with value and name, or just a string
                if (typeof item === 'object' && item.value) {
                    option.value = item.value;
                    option.textContent = item.name;
                } else {
                    option.value = item;
                    option.textContent = item;
                }

                select.appendChild(option);
            });

            select.addEventListener('change', () => this.updateAvatarPreview());
        });

        // Add event listener for facial hair checkbox
        if (this.checkFacialHair) {
            this.checkFacialHair.addEventListener('change', () => this.updateAvatarPreview());
        }

        // Add event listener for accessories checkbox
        if (this.checkAccessories) {
            this.checkAccessories.addEventListener('change', () => this.updateAvatarPreview());
        }
    }

    updateAvatarPreview() {
        const params = [];
        console.log(this.selects);
        // User customizable options (including hair)
        Object.keys(this.selects).forEach(key => {
            const val = this.selects[key].value;

            this.avatarConfig[key] = val;
            params.push(`${key}=${val}`);

        });

        // Handle facial hair checkbox
        if (this.checkFacialHair && this.checkFacialHair.checked) {
            this.avatarConfig.hasFacialHair = true;
            params.push('facialHairType=beardMajestic'); // Default to light beard
            params.push('facialHairProbability=100');
        } else {
            this.avatarConfig.hasFacialHair = false;
        }

        // Handle accessories checkbox
        if (this.checkAccessories && this.checkAccessories.checked) {
            this.avatarConfig.hasAccessories = true;
            params.push('accessoriesType=round'); // Default to round glasses
            params.push('accessoriesProbability=100');
        } else {
            this.avatarConfig.hasAccessories = false;
        }

        // Fixed clothing (tank top jersey with team color)
        params.push('clothing=shirtScoopNeck');
        params.push(`clothesColor=${this.teamJerseyColor}`);

        console.log(params);

        // Generate seed with player ID and current date
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const seed = `${this.jugadorId}-${currentDate}`;

        const baseUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
        const url = params.length ? `${baseUrl}&${params.join('&')}` : baseUrl;
        console.log(url);
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
                    if (data.avatarConfig) {
                        this.avatarConfig = data.avatarConfig;
                        Object.keys(data.avatarConfig).forEach(key => {
                            if (this.selects[key]) {
                                this.selects[key].value = data.avatarConfig[key];
                            }
                        });

                        // Load facial hair checkbox state
                        if (this.checkFacialHair && data.avatarConfig.hasFacialHair) {
                            this.checkFacialHair.checked = true;
                        }

                        // Load accessories checkbox state
                        if (this.checkAccessories && data.avatarConfig.hasAccessories) {
                            this.checkAccessories.checked = true;
                        }
                    } else {
                        // Set default neutral values
                        this.avatarConfig = {
                            skinColor: 'ffdbb4', // Piel clara
                            top: 'shortFlat', // Pelo corto plano
                            hairColor: 'a55728', // Castaño
                            eyes: 'default',
                            eyebrows: 'default',
                            mouth: 'default',
                            hasFacialHair: false,
                            hasAccessories: false
                        };
                        this.selects.skinColor.value = 'ffdbb4';
                        this.selects.top.value = 'shortFlat';
                        this.selects.hairColor.value = 'a55728';
                        this.selects.eyes.value = 'default';
                        this.selects.eyebrows.value = 'default';
                        this.selects.mouth.value = 'default';
                        if (this.checkFacialHair) {
                            this.checkFacialHair.checked = false;
                        }
                        if (this.checkAccessories) {
                            this.checkAccessories.checked = false;
                        }
                    }
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
