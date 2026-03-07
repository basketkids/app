import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { Match, MatchEvent, MatchState, MatchTimerState } from '../match.model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>;

@Injectable({
    providedIn: 'root'
})
export class MatchRepository {
    private readonly TABLE_NAME = 'matches';

    constructor(private supabase: SupabaseDataClient) { }

    /**
     * Fetches a match by ID and maps the flat Supabase columns to the Match model.
     */
    async getMatchById(id: string): Promise<Match | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('[MatchRepository] failed to load match:', error);
            return null;
        }

        // Build Match from flat columns
        const match = this.rowToMatch(data);

        // Fetch events, stats, full team roster, and match rosters in parallel
        const [eventsRes, statsRes, playersRes, rostersRes] = await Promise.all([
            this.supabase.instance.from('match_events').select('*, players(name, number)').eq('match_id', id).order('created_at', { ascending: false }),
            this.supabase.instance.from('match_player_stats').select('*, players(name, number, avatar_configs(*))').eq('match_id', id),
            this.supabase.instance.from('players').select('id, name, number, avatar_configs(*)').eq('team_id', data['team_id']),
            this.supabase.instance.from('match_rosters').select('player_id').eq('match_id', id)
        ]);

        if (!eventsRes.error && eventsRes.data) {
            match.events = {};
            eventsRes.data.forEach(ev => {
                let evPlayerData = ev.players;
                if (Array.isArray(evPlayerData)) evPlayerData = evPlayerData[0];

                match.events[ev.id] = {
                    id: ev.id,
                    type: (ev.event_type_id || ev.type || ev.event_type) as any,
                    quarter: ev.quarter || 1,
                    secondsRemaining: ev.timestamp ?? (ev.minute ? ev.minute * 60 : 0),
                    playerId: ev.player_id || -2,
                    playerName: evPlayerData?.name,
                    playerDorsal: evPlayerData?.number,
                    quantity: ev.value ?? ev.points ?? null,
                    detail: ev.properties ?? ev.description ?? null
                };
            });
        }

        if (!statsRes.error && statsRes.data) {
            match.stats = {};
            match.roster = {};

            statsRes.data.forEach(st => {
                const pid = st.player_id;
                if (!pid) return;

                // Safely extract player table join
                let playerData = st.players;
                if (Array.isArray(playerData)) playerData = playerData[0];

                let ac = playerData?.avatar_configs;
                if (Array.isArray(ac)) ac = ac[0];

                match.roster[pid] = {
                    id: pid,
                    name: playerData?.name || 'Desconocido',
                    dorsal: playerData?.number || 0,
                    avatarConfig: ac || null
                };

                const points = st.points || 0;
                const fouls = st.faltas || 0;
                const assists = st.asistencias || 0;
                const rebounds = st.rebotes || 0;
                const steals = st.robos || 0;
                const blocks = st.tapones || 0;

                // Old app formula approximation: PTS + REB + AST + STL + BLK - FOULS
                const valoracion = points + rebounds + assists + steals + blocks - fouls;

                match.stats[pid] = {
                    points,
                    fouls,
                    assists,
                    rebounds,
                    steals,
                    blocks,
                    valoracion,
                    plusMinus: st.mas_menos ?? 0 // If not in DB, we'll calculate it from events below
                };
            });

            // Calculate Plus/Minus dynamically from events if we have properties.jugadoresEnPista
            if (eventsRes.data) {
                // 1. Build a map of Legacy Firebase IDs -> New Supabase UUIDs
                // because `jugadoresEnPista` stores array of legacy IDs ("-OeR...")
                const legacyToUuid = new Map<string, string>();
                eventsRes.data.forEach(ev => {
                    const legacyId = ev.properties?.jugadorId;
                    if (legacyId && ev.player_id) {
                        legacyToUuid.set(legacyId, ev.player_id);
                    }
                });

                // 2. Iterate events to compute +/-
                eventsRes.data.forEach(ev => {
                    const type = ev.event_type_id || ev.type || ev.event_type;
                    const points = ev.value ?? ev.points ?? 0;

                    if (type === 'puntos' && points > 0) {
                        const enPista = ev.properties?.jugadoresEnPista || [];
                        const isLocalScore = !!ev.player_id; // In old app, null player_id meant rival point

                        enPista.forEach((pid: string) => {
                            const actualPid = legacyToUuid.get(pid) || pid;
                            if (match.stats[actualPid]) {
                                match.stats[actualPid].plusMinus = (match.stats[actualPid].plusMinus || 0) + (isLocalScore ? points : -points);
                            }
                        });
                    }
                });
            }
        }

        // Populate plantilla from players table
        if (!playersRes.error && playersRes.data) {
            playersRes.data.forEach(p => {
                let ac = p.avatar_configs;
                if (Array.isArray(ac)) ac = ac[0];

                match.plantilla[p.id] = {
                    id: p.id,
                    name: p.name,
                    dorsal: p.number,
                    avatarConfig: (ac as unknown as Record<string, string | number>) || null
                };
            });
        }

        // Map convocados from new relational table or default to legacy/stats
        const liveState = data['live_state'] || {};

        if (!rostersRes.error && rostersRes.data && rostersRes.data.length > 0) {
            rostersRes.data.forEach(row => {
                const pid = row.player_id;
                if (match.plantilla[pid]) match.convocados[pid] = match.plantilla[pid];
            });
        } else {
            const legacyConvocados = liveState.convocados || null;
            if (legacyConvocados && Object.keys(legacyConvocados).length > 0) {
                // Live state stores as record or array, handle parsing if it's an object/array
                if (Array.isArray(legacyConvocados)) { // Unlikely based on old code, but safe
                    legacyConvocados.forEach(pid => {
                        if (match.plantilla[pid]) match.convocados[pid] = match.plantilla[pid];
                    });
                } else { // It's an object mapping ID -> properties
                    Object.keys(legacyConvocados).forEach(pid => {
                        if (match.plantilla[pid]) match.convocados[pid] = match.plantilla[pid];
                    });
                }
            } else {
                // Fallback for matches with no explicit convocatoria yet: anyone who has stats
                match.convocados = { ...match.roster };
            }
        }

        // Map playersOnCourt from live_state
        match.playersOnCourt = liveState.jugadoresEnPista || {};

        console.log('[MatchRepository] Final built Match object:', JSON.stringify(match, null, 2));
        console.log(`[MatchRepository] MATCH SCORE => Local: ${match.scoreLocal}, Visitor: ${match.scoreVisitor}, quarter: ${match.currentQuarter}`);
        return match;
    }

    /** Maps Spanish legacy states -> English MatchState */
    private mapLegacyState(estadoSpa: string): MatchState {
        const stateMap: Record<string, MatchState> = {
            'pendiente': MatchState.SCHEDULED,
            'en_curso': MatchState.IN_PROGRESS,
            'en curso': MatchState.IN_PROGRESS,
            'finalizado': MatchState.FINISHED,
            'finished': MatchState.FINISHED,
        };
        return stateMap[estadoSpa] ?? MatchState.SCHEDULED;
    }

    /** Maps flat Supabase columns → Match interface */
    private rowToMatch(row: SupabaseRow): Match {
        const isLocal: boolean = row['is_local'] ?? true;

        let teamData = row['teams'];
        if (Array.isArray(teamData)) teamData = teamData[0];
        const teamName: string = (teamData?.name ?? row['team_name'] ?? 'Mi Equipo') as string;
        const rivalName: string = (row['rival_name'] ?? 'Rival') as string;

        const state: MatchState = this.mapLegacyState(row['state']);

        const timerState: MatchTimerState = { active: false, remainingSeconds: 600 };

        return {
            id: row['id'],
            teamId: row['team_id'],
            competitionId: row['competition_id'],
            state,
            date: row['date'] ?? null,
            venue: row['location'] ?? null,
            localTeamName: isLocal ? teamName : rivalName,
            visitorTeamName: isLocal ? rivalName : teamName,
            isLocal,
            scoreLocal: isLocal ? (row['team_score'] ?? 0) : (row['rival_score'] ?? 0),
            scoreVisitor: isLocal ? (row['rival_score'] ?? 0) : (row['team_score'] ?? 0),
            currentQuarter: row['live_state']?.currentQuarter ?? 1,
            timerState,
            events: row['events'] ?? {},
            stats: row['stats'] ?? {},
            roster: row['roster'] ?? {},
            plantilla: {},
            convocados: {},
            playersOnCourt: {},
            chronicle: row['chronicle'] ?? null
        };
    }

    async appendMatchEvent(matchId: string, event: MatchEvent): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from('match_events')
            .insert([{
                id: event.id,
                match_id: matchId,
                event_type_id: event.type,
                player_id: event.playerId === -2 ? null : event.playerId,
                quarter: event.quarter,
                timestamp: event.secondsRemaining,
                value: event.quantity,
                properties: (event as any).properties ?? event.detail ?? null
            }]);

        if (error) {
            console.error('[MatchRepository] appendMatchEvent error:', error);
            return false;
        }
        return true;
    }

    /**
     * Subscribes to realtime updates for a specific match, its events, and rosters.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribeToMatch(matchId: string, onUpdate: (data: { type: 'match' | 'event' | 'roster', payload: any }) => void): () => void {
        const channel = this.supabase.instance.channel(`realtime:match:${matchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: this.TABLE_NAME, filter: `id=eq.${matchId}` },
                (payload) => onUpdate({ type: 'match', payload })
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
                (payload) => onUpdate({ type: 'event', payload })
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'match_rosters', filter: `match_id=eq.${matchId}` },
                (payload) => onUpdate({ type: 'roster', payload })
            )
            .subscribe();

        return () => {
            this.supabase.instance.removeChannel(channel);
        };
    }

    async saveMatchState(matchId: string, match: Match): Promise<boolean> {
        console.log('[MatchRepository] saveMatchState:', matchId, match);
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .update({
                team_score: match.isLocal ? match.scoreLocal : match.scoreVisitor,
                rival_score: match.isLocal ? match.scoreVisitor : match.scoreLocal,
                state: match.state,
                live_state: {
                    currentQuarter: match.currentQuarter,
                    jugadoresEnPista: match.playersOnCourt,
                }
            })
            .eq('id', matchId);

        if (error) {
            console.error('[MatchRepository] saveMatchState error:', error);
            return false;
        }
        return true;
    }

    async updateConvocatoria(matchId: string, playerIds: string[]): Promise<boolean> {
        // 1. Delete existing roster for this match
        const { error: delError } = await this.supabase.instance
            .from('match_rosters')
            .delete()
            .eq('match_id', matchId);

        if (delError) {
            console.error('[MatchRepository] Error deleting old roster:', delError);
            return false;
        }

        if (playerIds.length === 0) return true;

        // 2. Insert new roster relationships
        const inserts = playerIds.map(pid => ({ match_id: matchId, player_id: pid }));
        const { error: insError } = await this.supabase.instance
            .from('match_rosters')
            .insert(inserts);

        if (insError) {
            console.error('[MatchRepository] Error inserting new roster:', insError);
            return false;
        }

        return true;
    }

    async getMatchesByTeam(teamId: string): Promise<Match[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .eq('team_id', teamId)
            .order('date', { ascending: true });

        if (error || !data) return [];
        return data.map(d => this.rowToMatch(d));
    }

    async getMatchesByTeams(teamIds: string[]): Promise<Match[]> {
        if (!teamIds || teamIds.length === 0) return [];

        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .in('team_id', teamIds)
            .order('date', { ascending: true });

        if (error || !data) return [];
        return data.map(d => this.rowToMatch(d));
    }

    async getMatchesByCompetition(compId: string): Promise<Match[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .eq('competition_id', compId)
            .order('date', { ascending: true });

        if (error || !data) return [];
        return data.map(d => this.rowToMatch(d));
    }

    async getMatchesByDateRange(startDate: string, endDate: string): Promise<Match[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error || !data) return [];
        return data.map(d => this.rowToMatch(d));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async createMatch(matchPayload: any): Promise<Match | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .insert([matchPayload])
            .select('id, date, is_local, location, state, team_id, rival_id, rival_name, team_score, rival_score, chronicle, live_state, teams(name)')
            .single();

        if (error || !data) {
            console.error('[MatchRepository] createMatch error:', error);
            return null;
        }

        return this.rowToMatch(data);
    }

    async deleteMatch(matchId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', matchId);

        if (error) {
            console.error('[MatchRepository] deleteMatch error:', error);
            return false;
        }

        return true;
    }

    /**
     * Aggregate player stats across ALL finished matches for a team.
     * Returns per-player totals and game counts (for computing averages in the UI).
     */
    async getAggregateStatsByTeam(teamId: string): Promise<AggregatedPlayerStat[]> {
        // 1. Get all match IDs for the team
        const { data: matches, error: mErr } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id')
            .eq('team_id', teamId);

        console.log('[getAggregateStatsByTeam] matches:', matches, 'error:', mErr);

        if (mErr || !matches || matches.length === 0) return [];

        const matchIds = matches.map((m: any) => m.id);

        // 2. Get all player stats rows (flat, no join)
        const { data: rows, error: sErr } = await this.supabase.instance
            .from('match_player_stats')
            .select('*')
            .in('match_id', matchIds);

        console.log('[getAggregateStatsByTeam] stat rows:', rows?.length, 'error:', sErr);

        if (sErr || !rows || rows.length === 0) return [];

        // 3. Get the unique player IDs
        const playerIds = [...new Set(rows.map((r: any) => r.player_id).filter(Boolean))];

        if (playerIds.length === 0) return [];

        // 4. Fetch player info separately
        const { data: players, error: pErr } = await this.supabase.instance
            .from('players')
            .select('id, name, number, avatar_configs(*)')
            .in('id', playerIds);

        console.log('[getAggregateStatsByTeam] players:', players?.length, 'error:', pErr);

        const playerMap: Record<string, any> = {};
        (players || []).forEach((p: any) => {
            let ac = p.avatar_configs;
            if (Array.isArray(ac)) ac = ac[0];
            playerMap[p.id] = { name: p.name, dorsal: parseInt(p.number ?? '0', 10) || 0, avatarConfig: ac || null };
        });

        // 5. Aggregate per player
        const map: Record<string, AggregatedPlayerStat> = {};
        rows.forEach((r: any) => {
            const pid = r.player_id;
            if (!pid) return;

            const playerData = playerMap[pid] || { name: 'Desconocido', dorsal: 0, avatarConfig: null };

            if (!map[pid]) {
                map[pid] = {
                    playerId: pid,
                    name: playerData.name,
                    dorsal: playerData.dorsal,
                    avatarConfig: playerData.avatarConfig,
                    gamesPlayed: 0,
                    totalPoints: 0, totalFouls: 0, totalAssists: 0,
                    totalRebounds: 0, totalSteals: 0, totalBlocks: 0, totalValoracion: 0
                };
            }
            const p = map[pid];
            p.gamesPlayed++;
            p.totalPoints += r.points || 0;
            p.totalFouls += r.faltas || r.fouls || 0;
            p.totalAssists += r.asistencias || r.assists || 0;
            // DB column is "rebounds" (English), legacy may have "rebotes"
            p.totalRebounds += r.rebounds || r.rebotes || 0;
            p.totalSteals += r.robos || r.steals || 0;
            p.totalBlocks += r.tapones || r.blocks || 0;
            const reb = r.rebounds || r.rebotes || 0;
            const ast = r.asistencias || r.assists || 0;
            const stl = r.robos || r.steals || 0;
            const blk = r.tapones || r.blocks || 0;
            const flt = r.faltas || r.fouls || 0;
            const val = (r.points || 0) + reb + ast + stl + blk - flt;
            p.totalValoracion += val;

        });

        const result = Object.values(map);
        console.log('[getAggregateStatsByTeam] final aggregated players:', result.length);
        return result;
    }

    /** Same aggregation but scoped to a single competition. */
    async getAggregateStatsByCompetition(competitionId: string): Promise<AggregatedPlayerStat[]> {
        const { data: matches, error: mErr } = await this.supabase.instance
            .from(this.TABLE_NAME).select('id').eq('competition_id', competitionId);
        if (mErr || !matches || matches.length === 0) return [];
        const matchIds = matches.map((m: any) => m.id);
        const { data: rows, error: sErr } = await this.supabase.instance
            .from('match_player_stats').select('*').in('match_id', matchIds);
        if (sErr || !rows || rows.length === 0) return [];
        const playerIds = [...new Set(rows.map((r: any) => r.player_id).filter(Boolean))];
        if (playerIds.length === 0) return [];
        const { data: players } = await this.supabase.instance
            .from('players').select('id, name, number, avatar_configs(*)').in('id', playerIds);
        const playerMap: Record<string, any> = {};
        (players || []).forEach((p: any) => {
            let ac = p.avatar_configs;
            if (Array.isArray(ac)) ac = ac[0];
            playerMap[p.id] = { name: p.name, dorsal: parseInt(p.number ?? '0', 10) || 0, avatarConfig: ac || null };
        });
        const map: Record<string, AggregatedPlayerStat> = {};
        rows.forEach((r: any) => {
            const pid = r.player_id;
            if (!pid) return;
            const pd = playerMap[pid] || { name: 'Desconocido', dorsal: 0, avatarConfig: null };
            if (!map[pid]) {
                map[pid] = { playerId: pid, name: pd.name, dorsal: pd.dorsal, avatarConfig: pd.avatarConfig, gamesPlayed: 0, totalPoints: 0, totalFouls: 0, totalAssists: 0, totalRebounds: 0, totalSteals: 0, totalBlocks: 0, totalValoracion: 0 };
            }
            const p = map[pid];
            p.gamesPlayed++;
            p.totalPoints += r.points || 0;
            p.totalFouls += r.faltas || r.fouls || 0;
            p.totalAssists += r.asistencias || r.assists || 0;
            p.totalRebounds += r.rebounds || r.rebotes || 0;
            p.totalSteals += r.robos || r.steals || 0;
            p.totalBlocks += r.tapones || r.blocks || 0;
            const reb = r.rebounds || r.rebotes || 0;
            const ast = r.asistencias || r.assists || 0;
            const stl = r.robos || r.steals || 0;
            const blk = r.tapones || r.blocks || 0;
            const flt = r.faltas || r.fouls || 0;
            p.totalValoracion += (r.points || 0) + reb + ast + stl + blk - flt;
        });
        return Object.values(map);
    }

    async getMatchScoresByTeam(teamId: string): Promise<MatchScore[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME).select('id, date, team_score, rival_score, rival_name, state, competition_id')
            .eq('team_id', teamId).eq('state', 'finalizado').order('date', { ascending: true });
        if (error || !data) return [];
        return data.map((m: any) => ({
            matchId: m.id,
            competitionId: m.competition_id,
            date: m.date ? new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?',
            ourScore: m.team_score ?? 0, rivalScore: m.rival_score ?? 0, rivalName: m.rival_name || 'Rival',
        }));
    }

    async getMatchScoresByCompetition(competitionId: string): Promise<MatchScore[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME).select('id, date, team_score, rival_score, rival_name, state')
            .eq('competition_id', competitionId).eq('state', 'finalizado').order('date', { ascending: true });
        if (error || !data) return [];
        return data.map((m: any) => ({
            matchId: m.id,
            date: m.date ? new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?',
            ourScore: m.team_score ?? 0, rivalScore: m.rival_score ?? 0, rivalName: m.rival_name || 'Rival',
        }));
    }

    async getPlayerMatchLog(playerId: string): Promise<PlayerMatchLog[]> {
        // 1. Fetch stat rows for this player (no join, use * like getAggregateStatsByTeam)
        const { data: rows, error: sErr } = await this.supabase.instance
            .from('match_player_stats')
            .select('*')
            .eq('player_id', playerId);

        if (sErr || !rows || rows.length === 0) return [];

        const matchIds = [...new Set(rows.map((r: any) => r.match_id).filter(Boolean))];
        if (matchIds.length === 0) return [];

        // 2. Fetch match details separately
        const { data: matches, error: mErr } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('id, date, team_score, rival_score, rival_name, state, competition_id')
            .in('id', matchIds)
            .eq('state', 'finalizado')
            .order('date', { ascending: true });

        if (mErr || !matches || matches.length === 0) return [];

        const matchMap: Record<string, any> = {};
        matches.forEach((m: any) => { matchMap[m.id] = m; });

        return rows.map((r: any) => {
            const m = matchMap[r.match_id];
            if (!m) return null;
            const reb = r.rebounds || r.rebotes || 0;
            const ast = r.asistencias || r.assists || 0;
            const stl = r.robos || r.steals || 0;
            const blk = r.tapones || r.blocks || 0;
            const flt = r.faltas || r.fouls || 0;
            const pts = r.points || 0;
            const val = pts + reb + ast + stl + blk - flt;
            return {
                matchId: m.id,
                competitionId: m.competition_id,
                dateStr: m.date ? new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?',
                ourScore: m.team_score ?? 0,
                rivalScore: m.rival_score ?? 0,
                rivalName: m.rival_name || 'Rival',
                points: pts,
                fouls: flt,
                assists: ast,
                rebounds: reb,
                steals: stl,
                blocks: blk,
                valoracion: val
            };
        }).filter(Boolean) as PlayerMatchLog[];
    }

}

export interface PlayerMatchLog {
    matchId: string;
    competitionId?: string;
    dateStr: string;
    ourScore: number;
    rivalScore: number;
    rivalName: string;
    points: number;
    fouls: number;
    assists: number;
    rebounds: number;
    steals: number;
    blocks: number;
    valoracion: number;
}

export interface AggregatedPlayerStat {
    playerId: string;
    name: string;
    dorsal: number;
    avatarConfig: any;
    gamesPlayed: number;
    totalPoints: number;
    totalFouls: number;
    totalAssists: number;
    totalRebounds: number;
    totalSteals: number;
    totalBlocks: number;
    totalValoracion: number;
}

export interface MatchScore {
    matchId: string;
    competitionId?: string;
    date: string;
    ourScore: number;
    rivalScore: number;
    rivalName: string;
}
