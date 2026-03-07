class TeamMembersService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    async getMembers(ownerUid, teamId, callback) {
        const fetchMembers = async () => {
            const { data, error } = await this.supabase
                .from('team_members')
                .select(`
                    *,
                    profiles:user_id (email, display_name, photo_url)
                `)
                .eq('team_id', teamId);

            if (!error && callback) {
                callback(data || []);
            }
        };
        fetchMembers();
    }

    async addMember(ownerUid, teamId, memberUid, role = 'follower') {
        const { error } = await this.supabase
            .from('team_members')
            .upsert({
                team_id: teamId,
                user_id: memberUid,
                role: role
            });

        if (error) throw error;
    }

    async updateMemberRole(ownerUid, teamId, memberUid, role) {
        const { error } = await this.supabase
            .from('team_members')
            .update({ role: role })
            .eq('team_id', teamId)
            .eq('user_id', memberUid);

        if (error) throw error;
    }

    async linkPlayer(ownerUid, teamId, memberUid, playerId) {
        const { error } = await this.supabase
            .from('team_members')
            .update({ linked_player_id: playerId })
            .eq('team_id', teamId)
            .eq('user_id', memberUid);

        if (error) throw error;
    }

    async removeMember(ownerUid, teamId, memberUid) {
        const { error } = await this.supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', memberUid);

        if (error) throw error;
    }

    getFollowers(ownerUid, teamId, callback) {
        const fetchFollowers = async () => {
            const { data, error } = await this.supabase
                .from('team_followers')
                .select(`
                    *,
                    profiles:user_id (email, display_name, photo_url)
                `)
                .eq('team_id', teamId);

            if (!error && callback) {
                callback(data || []);
            }
        };
        fetchFollowers();
    }
}
