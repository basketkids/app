class PlayerService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    async getSquad(userId, teamId) {
        // userId is not strictly needed if RLS allows reading based on teamId
        // But RLS usually checks if user is owner or member of team.
        // Queries should just filter by team_id
        const { data, error } = await this.supabase
            .from('players')
            .select('*, avatar_configs(*)')
            .eq('team_id', teamId);

        if (error) throw error;

        // Map avatar_configs to avatarConfig property for compatibility
        return data.map(p => ({
            ...p,
            avatarConfig: p.avatar_configs
        }));
    }

    async add(userId, teamId, name, dorsal) {
        const { data, error } = await this.supabase
            .from('players')
            .insert([{
                team_id: teamId,
                name: Sanitizer.escape(name),
                dorsal: dorsal
            }])
            .select();

        if (error) throw error;
        return data[0];
    }

    async delete(userId, teamId, playerId) {
        const { error } = await this.supabase
            .from('players')
            .delete()
            .eq('id', playerId);
        // .eq('team_id', teamId) // RLS handles permission

        if (error) throw error;
    }

    async get(userId, teamId, playerId) {
        const { data, error } = await this.supabase
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single();

        if (error) throw error;
        return data;
    }

    async update(userId, teamId, playerId, data) {
        const safeData = Sanitizer.sanitizeObject(data);
        // Map fields if necessary
        const { error } = await this.supabase
            .from('players')
            .update(safeData)
            .eq('id', playerId);

        if (error) throw error;
    }
}
