class TeamService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    /**
     * Get all teams for a user and subscribe to changes.
     * @param {string} userId - The user ID (owner).
     * @param {function} callback - Function to call with the list of teams.
     * @returns {object} - Subscription object (call .unsubscribe() to stop).
     */
    getAll(userId, callback) {
        // Initial fetch
        this._fetchTeams(userId, callback);

        // Realtime subscription
        const channel = this.supabase
            .channel('public:teams')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'teams', filter: `owner_id=eq.${userId}` },
                () => {
                    this._fetchTeams(userId, callback);
                }
            )
            .subscribe();

        return channel;
    }

    async _fetchTeams(userId, callback) {
        const { data, error } = await this.supabase
            .from('teams')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching teams:', error);
            callback([]);
            return;
        }

        // Convert to array of objects compatible with old code if needed, 
        // but Supabase returns an array already.
        // Old code expected a Snapshot with .forEach or .val()? 
        // IndexApp uses: snapshot.forEach(childSnapshot => { const team = childSnapshot.val(); team.id = childSnapshot.key; ... })
        // We need to adapt IndexApp to handle an array directly.
        // Or we can simulate a snapshot? 
        // Better to return the array and update IndexApp to handle array.
        callback(data || []);
    }

    async create(userId, name) {
        const { data, error } = await this.supabase
            .from('teams')
            .insert([
                { owner_id: userId, name: Sanitizer.escape(name) }
            ])
            .select();

        if (error) throw error;
        return data[0];
    }

    async delete(userId, teamId) {
        // RLS ensures only owner can delete
        const { error } = await this.supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (error) throw error;
    }

    async get(userId, teamId) {
        const { data, error } = await this.supabase
            .from('teams')
            .select('*')
            .eq('id', teamId)
            // .eq('owner_id', userId) // RLS handles this, but good to be explicit or if we want to check ownership
            .single();

        if (error) throw error;
        return data;
    }

    // Legacy method adaptation: used to return a promise with snapshot
    // Now returns a promise with data object
    async getName(userId, teamId) {
        const { data, error } = await this.supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        if (error) throw error;
        // Legacy code might expect { val: () => "Name" }
        // We will update the caller to use .name directly
        return data ? data.name : null;
    }

    async update(userId, teamId, data) {
        const safeData = Sanitizer.sanitizeObject(data);
        // Map old fields to new schema if necessary. 
        // Assuming 'nombre' -> 'name', 'entrenador' -> 'coach', 'colorCamiseta' -> 'jersey_color'
        // If data keys are already correct, fine.
        // Let's assume we need to map:
        const updatePayload = {};
        if (safeData.nombre) updatePayload.name = safeData.nombre;
        if (safeData.entrenador) updatePayload.coach = safeData.entrenador;
        if (safeData.colorCamiseta) updatePayload.jersey_color = safeData.colorCamiseta;

        // If no mapping needed (keys match schema), use safeData directly.
        // But schema uses English (name, coach, jersey_color). Old app likely used Spanish keys?
        // TeamService.js create used 'nombre'.
        // So mapping is likely needed.

        if (Object.keys(updatePayload).length === 0) return; // Nothing to update or unknown keys

        const { error } = await this.supabase
            .from('teams')
            .update(updatePayload)
            .eq('id', teamId);

        if (error) throw error;
    }

    async followTeam(ownerUid, teamId, userUid) {
        try {
            // 1. Insert into team_followers
            const { error: followError } = await this.supabase
                .from('team_followers')
                .insert([{ team_id: teamId, user_id: userUid }]);

            if (followError) throw followError;

            // 2. Create notification
            const { error: notifError } = await this.supabase
                .from('notifications')
                .insert([{
                    user_id: ownerUid,
                    type: 'new_follower',
                    data: {
                        teamId: teamId,
                        followerUid: userUid
                    }
                }]);

            if (notifError) console.error("Error creating notification:", notifError);

            return true;
        } catch (e) {
            console.error("Error during followTeam operation:", e);
            throw e;
        }
    }

    async unfollowTeam(ownerUid, teamId, userUid) {
        const { error } = await this.supabase
            .from('team_followers')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', userUid);

        if (error) throw error;
    }

    async isFollowing(ownerUid, teamId, userUid) {
        const { data, error } = await this.supabase
            .from('team_followers')
            .select('*')
            .eq('team_id', teamId)
            .eq('user_id', userUid)
            .maybeSingle();

        if (error) return false;
        return !!data;
    }
}
