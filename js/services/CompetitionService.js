class CompetitionService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    async get(userId, teamId, compId) {
        const { data, error } = await this.supabase
            .from('competitions')
            .select('*')
            .eq('id', compId)
            .single();

        if (error) throw error;
        return data;
    }

    async getAll(userId, teamId, callback) {
        const fetchCompetitions = async () => {
            const { data, error } = await this.supabase
                .from('competitions')
                .select('*')
                .eq('team_id', teamId);

            if (!error && callback) {
                callback(data || []);
            }
        };

        fetchCompetitions();

        // Optional: Subscription
        // const channel = this.supabase.channel(...)
        // ...
        // returning channel to allow unsubscribe implies changing the contract
    }

    async create(userId, teamId, name) {
        const { data, error } = await this.supabase
            .from('competitions')
            .insert([{ team_id: teamId, name: name }])
            .select();

        if (error) throw error;
        return data[0];
    }

    async getRivals(userId, teamId, compId, callback) {
        const fetchRivals = async () => {
            const { data, error } = await this.supabase
                .from('rivals')
                .select('*')
                .eq('competition_id', compId);

            if (!error && callback) {
                callback(data || []);
            }
        };
        fetchRivals();
    }

    async addRival(userId, teamId, compId, name) {
        const { data, error } = await this.supabase
            .from('rivals')
            .insert([{ competition_id: compId, name: name }])
            .select();

        if (error) throw error;
        return data[0]; // returns object with id
    }

    async deleteRival(userId, teamId, compId, rivalId) {
        const { error } = await this.supabase
            .from('rivals')
            .delete()
            .eq('id', rivalId);
        if (error) throw error;
    }

    async update(userId, teamId, compId, updates) {
        const { error } = await this.supabase
            .from('competitions')
            .update(updates)
            .eq('id', compId);
        if (error) throw error;
    }

    async updateRival(userId, teamId, compId, rivalId, name) {
        const { error } = await this.supabase
            .from('rivals')
            .update({ name: name })
            .eq('id', rivalId);
        if (error) throw error;
    }

    async getMatches(userId, teamId, compId, callback) {
        const fetchMatches = async () => {
            const { data, error } = await this.supabase
                .from('matches')
                .select('*')
                .eq('competition_id', compId)
                .order('date', { ascending: true }); // Assuming date field

            if (!error && callback) {
                callback(data || []);
            }
        };
        fetchMatches();
    }

    async createMatch(userId, teamId, compId, matchData) {
        // matchData needs to be mapped to schema keys
        const payload = {
            competition_id: compId,
            team_id: teamId,
            rival_name: matchData.rival, // matchData passes 'rival' as name
            date: matchData.fecha,
            location: matchData.lugar,
            notes: matchData.notas || '',
            is_local: matchData.is_local !== undefined ? matchData.is_local : true,
            team_score: matchData.team_score || 0,
            rival_score: matchData.rival_score || 0,
            state: matchData.state || 'scheduled'
        };

        // If matchData has 'rivalId' (from select), use that to look up name?
        // Schema has rival_name (text). logic says 'rival' field in firebase was name string.

        const { data, error } = await this.supabase
            .from('matches')
            .insert([payload])
            .select();

        if (error) throw error;
        return data[0];
    }

    async deleteMatch(userId, teamId, compId, matchId) {
        const { error } = await this.supabase
            .from('matches')
            .delete()
            .eq('id', matchId);
        if (error) throw error;
    }

    async getMatchRival(userId, teamId, compId, rivalId) {
        const { data, error } = await this.supabase
            .from('rivals')
            .select('*')
            .eq('id', rivalId)
            .single();
        if (error) throw error;
        return data;
    }

    async findOrCreateRival(userId, teamId, compId, rivalName) {
        // 1. Search
        const { data: existing, error } = await this.supabase
            .from('rivals')
            .select('*')
            .eq('competition_id', compId)
            .ilike('name', rivalName) // Case insensitive
            .maybeSingle();

        if (existing) return existing.id;

        // 2. Create
        const { data: newRival, error: createError } = await this.supabase
            .from('rivals')
            .insert([{ competition_id: compId, name: rivalName }])
            .select()
            .single();

        if (createError) throw createError;
        return newRival.id;
    }
}
