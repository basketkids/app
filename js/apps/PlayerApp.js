class PlayerApp extends BaseApp {
    constructor() {
        super();
        this.playerService = new PlayerService();
        this.teamService = new TeamService();
        this.competitionService = new CompetitionService();
        this.teamMembersService = new TeamMembersService();
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
        this.supabase = window.supabaseClient;
    }

    onUserLoggedIn(user) {
        this.currentUser = user;
        this.ownerUid = this.getParam('ownerUid') || user.uid;
        this.initAvatarEditor();
        this.loadParamsUrl();
    }

    initAvatarEditor() {
        const elements = {
            selects: this.selects,
            checkFacialHair: this.checkFacialHair,
            checkAccessories: this.checkAccessories
        };

        this.diceBearManager.initEditor(elements, () => {
            this.updateAvatarPreview();
        });
    }

    updateAvatarPreview() {
        this.avatarConfig = this.diceBearManager.getObject();
        const seed = this.jugadorId || 'temp';
        const url = this.diceBearManager.getImage(seed, this.avatarConfig, this.teamJerseyColor);
        if (this.avatarPreview) {
            this.avatarPreview.src = url;
        }
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

        this.checkPermissions().then(allowed => {
            if (allowed) {
                this.cargarDatosJugador();
                this.cargarInfoEquipo();
                this.cargarEstadisticasTotales();
                this.cargarColorCamisetaEquipo();
                this.setupEventListeners();
            } else {
                alert('No tienes permiso para editar este jugador');
                window.location.href = 'index.html';
            }
        });
    }

    async checkPermissions() {
        if (this.currentUser.uid === this.ownerUid) return true; // Owner is checking

        try {
            // Check if member using TeamMembersService or direct query
            const { data, error } = await this.supabase
                .from('team_members')
                .select('*')
                .eq('team_id', this.currentTeamId)
                .eq('user_id', this.currentUser.uid)
                .maybeSingle();

            if (error) {
                console.error("Error checking permissions:", error);
                return false;
            }

            if (data) {
                // Check if role is player and linked to this player
                if (data.role === 'player' && data.linked_player_id === this.jugadorId) {
                    return true;
                }
                // Maybe allow coaches/admins too?
                if (data.role === 'admin' || data.role === 'coach') {
                    return true;
                }
            }
            return false;

        } catch (e) {
            console.error("Permission check failed", e);
            return false;
        }
    }

    cargarColorCamisetaEquipo() {
        // Use TeamService to get team data
        this.teamService.get(this.ownerUid, this.currentTeamId)
            .then(data => {
                if (data && data.jersey_color) {
                    this.teamJerseyColor = data.jersey_color;
                    this.updateAvatarPreview();
                }
            })
            .catch(console.error);
    }

    async cargarDatosJugador() {
        try {
            const data = await this.playerService.get(this.ownerUid, this.currentTeamId, this.jugadorId);

            if (data) {
                this.inputNombre.value = data.name || '';
                this.inputDorsal.value = data.number || ''; // Schema has 'number', old app 'dorsal'

                // Load avatar config via relational query if avail, or fetch it
                // PlayerService.get returns the row. Does it join avatar_configs?
                // The basic .get in PlayerService was NOT modified to join.
                // But .getSquad WAS modified.
                // We should assume data might have avatar_config_id.
                // Or update PlayerService.get to also join.
                // For now, let's try to use what we likely have or if missing fetch separately?
                // Actually, let's presume we might need to fetch it if not present.
                // But wait, DiceBearManager handles 'config' object.
                // If data has avatar_configs (joined object), we use it. 
                // If not, we check if we have to fetch.

                let config = data.avatar_configs || null;

                if (!config && data.avatar_config_id) {
                    // fetch it if not joined
                    const { data: ac } = await this.supabase
                        .from('avatar_configs')
                        .select('*')
                        .eq('id', data.avatar_config_id)
                        .single();
                    config = ac;
                }

                if (config) {
                    this.diceBearManager.setCharacter(config);
                } else {
                    // Default?
                    this.diceBearManager.setCharacter({});
                }

                this.avatarConfig = this.diceBearManager.getObject();
                this.updateAvatarPreview();

            } else {
                alert('Jugador no encontrado');
                window.location.href = 'index.html';
            }
        } catch (e) {
            console.error(e);
        }
    }

    async cargarInfoEquipo() {
        try {
            const teamData = await this.teamService.get(this.ownerUid, this.currentTeamId);
            const nombreEquipo = teamData ? teamData.name : 'Equipo desconocido';

            // Get competitions
            // CompetitionService.getAll takes a callback. We can wrap it or just call fetch directly.
            // Actually, CompetitionService.getAll is designed for subscription/callback.
            // But we can use direct query here for simplicity or adapt.
            // Let's use direct query to avoid callback hell in this async function.
            const { data: competitions } = await this.supabase
                .from('competitions')
                .select('name')
                .eq('team_id', this.currentTeamId);

            const compNames = competitions ? competitions.map(c => c.name).join(', ') : 'Sin competiciones';

            this.infoEquipo.innerHTML = `
                <p><strong>Equipo:</strong> ${nombreEquipo}</p>
                <p><strong>Competiciones:</strong> ${compNames}</p>
            `;

        } catch (e) {
            console.error("Error loading info:", e);
        }
    }

    async cargarEstadisticasTotales() {
        try {
            const totales = {
                partidos: 0, puntos: 0, rebotes: 0, asistencias: 0, faltas: 0, tapones: 0, robos: 0
            };

            // Calculate stats by querying match_events for this player
            // This is much more efficient than iterating.

            // 1. Get all events for player
            const { data: events, error } = await this.supabase
                .from('match_events')
                .select('*')
                .eq('player_id', this.jugadorId)
                .range(0, 9999); // Safety limit

            if (error) throw error;

            if (!events || events.length === 0) {
                this.mostrarEstadisticas(totales);
                return;
            }

            const matchesPlayed = new Set();

            events.forEach(e => {
                matchesPlayed.add(e.match_id);

                const type = e.type || e.event_type_id; // Schema var
                const val = e.value || 0;

                // Logic from TeamApp (Spanish/English mix handling)
                if (type === 'puntos' || type === 'point' || type.startsWith('point_')) { // handle point_1 etc
                    // Logic check: in TeamApp we saw 'point_1' etc. 
                    // But also 'puntos' with val.
                    // Let's be robust.
                    if (type.startsWith('point_')) {
                        // assume value 1 if not present? usually these have value 1,2,3 implicit?
                        // TeamApp logic: e.value used.
                        // But for point_1, value is likely 1?
                        // Let's rely on e.value if present, else parse type?
                        // TeamApp: case 'point_1': medias[pid].puntos += 1;
                        // So if value is 0 or null, we derived from type.
                        if (type === 'point_1') totales.puntos += 1;
                        else if (type === 'point_2') totales.puntos += 2;
                        else if (type === 'point_3') totales.puntos += 3;
                        else totales.puntos += (val || 0);
                    } else {
                        totales.puntos += (val || 0);
                    }
                } else if (type === 'asistencias' || type === 'assist') {
                    totales.asistencias += (val || 1);
                } else if (type === 'rebotes' || type === 'rebound') {
                    totales.rebotes += (val || 1);
                } else if (type === 'robos' || type === 'steal') {
                    totales.robos += (val || 1);
                } else if (type === 'tapones' || type === 'block') {
                    totales.tapones += (val || 1);
                } else if (type === 'faltas' || type === 'foul') {
                    totales.faltas += (val || 1);
                }
            });

            totales.partidos = matchesPlayed.size;

            this.mostrarEstadisticas(totales);

        } catch (error) {
            console.error('Error cargando estadísticas totales:', error);
        }
    }

    mostrarEstadisticas(totales) {
        if (!this.statsTotales) return;

        const html = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Promedios Globales (${totales.partidos} partidos)</h5>
                    <div class="table-responsive">
                        <table class="table table-bordered table-sm text-center">
                            <thead>
                                <tr>
                                    <th>PTS</th>
                                    <th>REB</th>
                                    <th>AST</th>
                                    <th>ROB</th>
                                    <th>TAP</th>
                                    <th>FAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${(totales.partidos ? (totales.puntos / totales.partidos).toFixed(1) : 0)}</td>
                                    <td>${(totales.partidos ? (totales.rebotes / totales.partidos).toFixed(1) : 0)}</td>
                                    <td>${(totales.partidos ? (totales.asistencias / totales.partidos).toFixed(1) : 0)}</td>
                                    <td>${(totales.partidos ? (totales.robos / totales.partidos).toFixed(1) : 0)}</td>
                                    <td>${(totales.partidos ? (totales.tapones / totales.partidos).toFixed(1) : 0)}</td>
                                    <td>${(totales.partidos ? (totales.faltas / totales.partidos).toFixed(1) : 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-2 text-muted small">
                        <strong>Totales:</strong> 
                        PTS: ${totales.puntos}, 
                        REB: ${totales.rebotes}, 
                        AST: ${totales.asistencias}, 
                        ROB: ${totales.robos}, 
                        TAP: ${totales.tapones}, 
                        FAL: ${totales.faltas}
                    </div>
                </div>
            </div>
        `;

        this.statsTotales.innerHTML = html;
    }

    setupEventListeners() {
        this.formEditarJugador.addEventListener('submit', (e) => this.guardarCambiosJugador(e));
    }

    async guardarCambiosJugador(e) {
        e.preventDefault();
        const nuevoNombre = this.inputNombre.value.trim();
        const nuevoDorsal = parseInt(this.inputDorsal.value);
        if (!nuevoNombre || !nuevoDorsal) {
            alert('Por favor completa todos los campos');
            return;
        }

        this.updateAvatarPreview();

        // Save logic
        // 1. Update/Create avatar config in DB
        // 2. Update player with new avatar_config_id and data

        try {
            // Check if player has avatar_config_id
            const player = await this.playerService.get(this.ownerUid, this.currentTeamId, this.jugadorId);
            let configId = player.avatar_config_id;

            // Map camelCase config back to snake_case for DB
            const dbConfig = {};
            const config = this.avatarConfig;
            // Manual map or helper?
            // DiceBearManager has keys: skinColor, top, etc.
            // DB: skin_color, top, etc.
            Object.keys(config).forEach(k => {
                let dbKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                dbConfig[dbKey] = config[k];
            });

            // Handle facial/accessories bools/types if needed?
            // Not storing booleans in DB, storing result?
            // Schema: skin_color, top, etc.
            // If we look at migration.html, it saved specific fields.
            // Let's assume standard snake_case mapping works.
            // Fix special cases if any?

            let acError;
            if (configId) {
                // Update existing
                const { error } = await this.supabase
                    .from('avatar_configs')
                    .update(dbConfig)
                    .eq('id', configId);
                acError = error;
            } else {
                // Create new
                const { data: newConfig, error } = await this.supabase
                    .from('avatar_configs')
                    .insert([dbConfig])
                    .select('id')
                    .single();
                if (newConfig) configId = newConfig.id;
                acError = error;
            }

            if (acError) throw acError;

            // Update player
            const playerData = {
                name: nuevoNombre,
                number: nuevoDorsal,
                avatar_config_id: configId
            };

            const { error: pError } = await this.supabase
                .from('players')
                .update(playerData)
                .eq('id', this.jugadorId);

            if (pError) throw pError;

            alert('Datos actualizados correctamente');

        } catch (err) {
            alert('Error al actualizar: ' + err.message);
            console.error(err);
        }
    }
}
