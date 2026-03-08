import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { UserProfile } from './profile.repository';

@Injectable({
    providedIn: 'root'
})
export class AdminRepository {
    constructor(private supabase: SupabaseDataClient) { }

    async getGlobalStats(): Promise<{
        profiles: UserProfile[],
        teams: any[],
        competitions: any[],
        matches: any[]
    }> {
        const sb = this.supabase.instance;

        const [profilesRes, teamsRes, compsRes, matchesRes] = await Promise.all([
            sb.from('profiles').select('*'),
            sb.from('teams').select('*'),
            sb.from('competitions').select('*'),
            sb.from('matches').select('*')
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (teamsRes.error) throw teamsRes.error;
        if (compsRes.error) throw compsRes.error;
        if (matchesRes.error) throw matchesRes.error;

        return {
            profiles: (profilesRes.data || []) as UserProfile[],
            teams: teamsRes.data || [],
            competitions: compsRes.data || [],
            matches: matchesRes.data || []
        };
    }

    async deleteTeam(teamId: string): Promise<void> {
        const { error } = await this.supabase.instance.from('teams').delete().eq('id', teamId);
        if (error) throw error;
    }

    async deleteMatch(matchId: string): Promise<void> {
        const { error } = await this.supabase.instance.from('matches').delete().eq('id', matchId);
        if (error) throw error;
    }
}
