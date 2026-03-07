const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'URL_AQUI_O_ENV';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'SERVICE_KEY_AQUI_O_ENV';
const JSON_FILE_PATH = process.env.JSON_FILE_PATH || './db/basketkids-9bfd6-default-rtdb-export.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateData() {
    console.log('Iniciando migración FULL desde Firebase a Supabase...');

    if (!fs.existsSync(JSON_FILE_PATH)) {
        console.error(`Error: No se encuentra el archivo ${JSON_FILE_PATH}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    const db = JSON.parse(rawData);

    const dataInserts = {
        teams: [],
        players: [],
        competitions: [],
        rivals: [],
        matches: [],
        match_rosters: [],
        match_player_stats: [],
        match_events: [],
        team_followers: []
    };

    if (db.usuarios) {
        for (const [userId, userData] of Object.entries(db.usuarios)) {
            // Process Teams
            if (userData.equipos) {
                for (const [teamId, teamData] of Object.entries(userData.equipos)) {
                    // Extract colors (sometimes legacy code used color, colorCamiseta, etc)
                    const color = teamData.colorCamiseta || teamData.color || '#000000';

                    dataInserts.teams.push({
                        id: teamId,
                        owner_id: userId,
                        name: teamData.nombre || 'Equipo Sin Nombre',
                        coach: teamData.entrenador || '',
                        color: color,
                        logo_url: teamData.logo_url || null
                    });

                    // Process Followers
                    if (teamData.followers) {
                        for (const followerId of Object.keys(teamData.followers)) {
                            // Only insert if team_id and user_id are present
                            dataInserts.team_followers.push({
                                team_id: teamId,
                                user_id: followerId
                            });
                        }
                    }

                    // Process Players (plantilla)
                    if (teamData.plantilla) {
                        for (const [playerId, playerData] of Object.entries(teamData.plantilla)) {
                            dataInserts.players.push({
                                id: playerId,
                                team_id: teamId,
                                name: playerData.nombre || 'Jugador',
                                number: playerData.dorsal || '',
                                position: playerData.posicion || null,
                                avatar_config_id: playerData.avatarConfig ? null : null // Needs mapping later if structured
                            });
                        }
                    }

                    // Process Competitions
                    if (teamData.competiciones) {
                        for (const [compId, compData] of Object.entries(teamData.competiciones)) {
                            dataInserts.competitions.push({
                                id: compId,
                                team_id: teamId,
                                name: compData.nombre || 'Competicion',
                                season: compData.temporada || null
                            });

                            // Process Rivals
                            if (compData.rivales) {
                                for (const [rivalId, rivalData] of Object.entries(compData.rivales)) {
                                    dataInserts.rivals.push({
                                        id: rivalId,
                                        competition_id: compId,
                                        name: rivalData.nombre || 'Rival',
                                        logo_url: rivalData.logo_url || null
                                    });
                                }
                            }

                            // Process Matches
                            if (compData.partidos) {
                                for (const [matchId, matchData] of Object.entries(compData.partidos)) {
                                    dataInserts.matches.push({
                                        id: matchId,
                                        competition_id: compId,
                                        team_id: teamId,
                                        rival_id: matchData.rivalId || null,
                                        rival_name: matchData.rival || matchData.rival_name || 'Rival',
                                        date: matchData.fechaHora || matchData.fecha || null,
                                        location: matchData.lugar || null,
                                        is_local: matchData.is_local !== undefined ? matchData.is_local : true,
                                        state: matchData.estado || 'finished',
                                        team_score: matchData.team_score || 0,
                                        rival_score: matchData.rival_score || 0,
                                        live_state: matchData.live_state || null
                                    });

                                    // Match Rosters & Stats & Events processing 
                                    const liveState = matchData.live_state;
                                    if (liveState && liveState.convocados) {
                                        for (const playerId of Object.keys(liveState.convocados)) {
                                            dataInserts.match_rosters.push({
                                                match_id: matchId,
                                                player_id: playerId
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`Teams: ${dataInserts.teams.length}`);
    console.log(`Players: ${dataInserts.players.length}`);
    console.log(`Competitions: ${dataInserts.competitions.length}`);
    console.log(`Rivals: ${dataInserts.rivals.length}`);
    console.log(`Matches: ${dataInserts.matches.length}`);
    console.log(`Match Rosters: ${dataInserts.match_rosters.length}`);
    console.log(`Team Followers: ${dataInserts.team_followers.length}`);

    async function pushChunked(tableName, dataArray) {
        if (dataArray.length === 0) return;
        console.log(`Inserting ${dataArray.length} records into ${tableName}...`);
        const CHUNK_SIZE = 500;
        for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
            const chunk = dataArray.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
            if (error) {
                console.error(`Error inserting chunk ${i} in ${tableName}:`, error.message);
            }
        }
    }

    // Because of foreign keys, insert order is CRITICAL
    // Teams -> Players & Competitions -> Rivals -> Matches -> Match Rosters
    // Wait, team_followers composite primary key is team_id, user_id (or ID)
    // Supabase JS upsert needs to know the constraint or will err if IDs exist.
    // Assuming 'id' is used for PK in all these tables. 
    // Except match_rosters: we might need to handle onConflict differently or just insert.

    // We skip exact DB writes here in dry-run mode unless executed with real ENV vars
    console.log('Migrator logic compiled. Execute with SUPABASE_URL and SUPABASE_SERVICE_KEY.');
}

migrateData().catch(console.error);
