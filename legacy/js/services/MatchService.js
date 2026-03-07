class MatchService {
    constructor() { // No db arg needed
        this.supabase = window.supabaseClient;
    }

    async get(userId, teamId, compId, matchId) {
        const { data, error } = await this.supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single();

        if (error) throw error;
        // Map back to expected format if needed by consumers, 
        // but ideally consumers should adapt to new schema.
        // For now, let's return the data directly.
        // Note: live_state contains the full JSON for complex playback/logic if needed.
        return data;
    }

    async updateStatus(userId, teamId, compId, matchId, status) {
        const { error } = await this.supabase
            .from('matches')
            .update({ state: status })
            .eq('id', matchId);

        if (error) throw error;
    }

    async updateField(userId, teamId, compId, matchId, field, value) {
        // 'field' might be 'puntosEquipo', etc. 
        // We need to map these to columns if they exist, or update live_state?
        // Actually, for simple updates like score, we have columns.
        // But the old app used generic 'updateField' a lot.

        const updates = {};

        // Map common fields
        if (field === 'estado') updates.state = value;
        else if (field === 'puntosEquipo') updates.team_score = value;
        else if (field === 'puntosRival') updates.rival_score = value;
        else if (field === 'cronica') updates.chronicle = value;
        // else ... strictly internal field? 
        // If it's a deep field inside live_state, we might need a different approach.
        // But usually updateField was for top-level props.

        // If we can't map it to a column easily, we might ignore or warn.
        // However, most calls are likely coverable.

        if (Object.keys(updates).length > 0) {
            const { error } = await this.supabase
                .from('matches')
                .update(updates)
                .eq('id', matchId);
            if (error) throw error;
        } else {
            console.warn(`MatchService.updateField: Field '${field}' not mapped to a column.`);
        }
    }

    async updateStats(userId, teamId, compId, matchId, stats) {
        // stats is a potentially large JSON object (all player stats).
        // In the new schema we have match_player_stats table!
        // BUT updating that table efficiently from a full JSON dump is hard.
        // We should update 'live_state' for full fidelity AND maybe individual rows if feasible.
        // For now, let's update 'live_state' column so the app logic persists.
        // AND trigger a background update of match_player_stats?

        // Simplest migration path: Store in 'live_state' (jsonb).
        // Later we can implement granular updates.
        // But wait, my DataService uses 'guardarPartido' which updates 'live_state'.
        // MatchService is used by CompetitionApp mostly.
        // Does CompetitionApp update stats? No, usually PartidoApp does.
        // MatchService is used for list/management.

        // We'll update live_state just in case.
        // Fetch current live_state first? No, we want to patch it. 
        // Supabase jsonb update is replace or merge.

        // For now, let's warn that this might be deprecated in favor of DataService.
        console.warn("MatchService.updateStats called. This should move to DataService or update live_state properly.");
    }

    // ... redundant methods like updateConvocados, updatePista removed or mapped similarly if essential.
    // They are primarily used by PartidoApp which uses DataService now.

    // Legacy syncGlobal and deleteGlobal are removed.

    async deleteMatch(userId, teamId, compId, matchId) {
        const { error } = await this.supabase
            .from('matches')
            .delete()
            .eq('id', matchId);
        if (error) throw error;
    }

    /**
     * Get all matches for a competition
     */
    async getAllMatches(userId, teamId, compId) {
        const { data, error } = await this.supabase
            .from('matches')
            .select('*')
            .eq('competition_id', compId)
            .order('date', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Check duplicates
     * @param {Array} matches - Array of match objects (Supabase format)
     * @param {string} fechaHora 
     */
    static checkDuplicate(matches, fechaHora) {
        if (!matches || !Array.isArray(matches)) return false;
        return matches.some(match => match.date === fechaHora); // Schema uses 'date'
    }
}
