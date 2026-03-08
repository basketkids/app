import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { Team } from '../team.model';
import { PlayerRosterData } from '../player.model';

@Injectable({
    providedIn: 'root'
})
export class TeamRepository {
    private readonly TABLE_NAME = 'teams';

    constructor(private supabase: SupabaseDataClient) { }

    /**
     * Fetches team metadata (e.g., coach name, colors).
     */
    async getTeamById(id: string): Promise<Team | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching team:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            coach: data.coach,
            jerseyColor: data.color,
            owner_id: data.owner_id,
            createdAt: data.created_at
        } as Team;
    }

    /**
     * Fetches the official roster of a team. 
     * (Separating roster loading from live game state management).
     */
    async getTeamRoster(teamId: string): Promise<PlayerRosterData[]> {
        const { data, error } = await this.supabase.instance
            .from('players') // assuming 'players' table
            .select('*, avatar_configs(*)')
            .eq('team_id', teamId);

        if (error || !data) return [];

        return data.map(p => {
            let ac = p.avatar_configs;
            if (Array.isArray(ac)) ac = ac[0];

            return {
                id: p.id,
                name: p.name,
                dorsal: p.dorsal,
                avatarConfig: ac || null
            };
        });
    }

    async getTeamsByUser(userId: string): Promise<Team[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[TeamRepository] getTeamsByUser error:', error);
            return [];
        }

        return data.map(d => ({
            id: d.id,
            name: d.name,
            coach: d.coach,
            jerseyColor: d.color,
            owner_id: d.owner_id,
            createdAt: d.created_at
        }));
    }

    async createTeam(userId: string, name: string): Promise<Team | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .insert([{ owner_id: userId, name }])
            .select()
            .single();

        if (error || !data) {
            console.error('[TeamRepository] createTeam error:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            coach: data.coach,
            jerseyColor: data.color,
            owner_id: data.owner_id,
            createdAt: data.created_at
        } as Team;
    }

    async updateTeam(teamId: string, updates: Partial<Team>): Promise<boolean> {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.coach !== undefined) payload.coach = updates.coach;
        if (updates.jerseyColor !== undefined) payload.color = updates.jerseyColor;

        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .update(payload)
            .eq('id', teamId);

        if (error) {
            console.error('[TeamRepository] updateTeam error:', error);
            return false;
        }

        return true;
    }

    async deleteTeam(teamId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', teamId);

        if (error) {
            console.error('[TeamRepository] deleteTeam error:', error);
            return false;
        }

        return true;
    }

    async followTeam(teamId: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from('team_followers')
            .insert([{ team_id: teamId, user_id: userId }]);

        if (error) {
            console.error('[TeamRepository] followTeam error:', error);
            return false;
        }

        return true;
    }

    async unfollowTeam(teamId: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from('team_followers')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (error) {
            console.error('[TeamRepository] unfollowTeam error:', error);
            return false;
        }

        return true;
    }

    async isFollowing(teamId: string, userId: string): Promise<boolean> {
        const { data, error } = await this.supabase.instance
            .from('team_followers')
            .select('*')
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[TeamRepository] isFollowing error:', error);
            return false;
        }

        return !!data;
    }

    async getFollowedTeams(userId: string): Promise<any[]> {
        const { data, error } = await this.supabase.instance
            .from('team_followers')
            .select('team_id, teams(id, name, owner_id)')
            .eq('user_id', userId);

        if (error) {
            console.error('[TeamRepository] getFollowedTeams error:', error);
            throw error;
        }

        return data ?? [];
    }

    subscribeToTeams(userId: string, callback: () => void): { unsubscribe: () => void } {
        const channel = this.supabase.instance
            .channel(`teams-changes-${userId}-${Date.now()}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'teams', filter: `owner_id=eq.${userId}` },
                () => callback()
            )
            .subscribe();

        return {
            unsubscribe: () => {
                this.supabase.instance.removeChannel(channel);
            }
        };
    }
}
