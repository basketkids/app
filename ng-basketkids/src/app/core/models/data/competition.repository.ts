import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { Competition, Rival } from '../competition.model';

@Injectable({
    providedIn: 'root'
})
export class CompetitionRepository {
    private readonly COMP_TABLE = 'competitions';
    private readonly RIVAL_TABLE = 'rivals';

    constructor(private supabase: SupabaseDataClient) { }

    // --- COMPETITIONS ---

    async getCompetitionsByTeam(teamId: string): Promise<Competition[]> {
        const { data, error } = await this.supabase.instance
            .from(this.COMP_TABLE)
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[CompetitionRepository] getCompetitionsByTeam error:', error);
            return [];
        }
        return data.map(this.mapRowToCompetition);
    }

    async getCompetitionById(compId: string): Promise<Competition | null> {
        const { data, error } = await this.supabase.instance
            .from(this.COMP_TABLE)
            .select('*')
            .eq('id', compId)
            .single();

        if (error || !data) {
            console.error('[CompetitionRepository] getCompetitionById error:', error);
            return null;
        }
        return this.mapRowToCompetition(data);
    }

    async createCompetition(teamId: string, name: string, season?: string): Promise<Competition | null> {
        const { data, error } = await this.supabase.instance
            .from(this.COMP_TABLE)
            .insert([{ team_id: teamId, name, season }])
            .select()
            .single();

        if (error || !data) {
            console.error('[CompetitionRepository] createCompetition error:', error);
            return null;
        }
        return this.mapRowToCompetition(data);
    }

    async updateCompetition(compId: string, updates: Partial<Competition>): Promise<Competition | null> {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.season !== undefined) payload.season = updates.season;

        const { data, error } = await this.supabase.instance
            .from(this.COMP_TABLE)
            .update(payload)
            .eq('id', compId)
            .select()
            .single();

        if (error || !data) {
            console.error('[CompetitionRepository] updateCompetition error:', error);
            return null;
        }
        return this.mapRowToCompetition(data);
    }

    async deleteCompetition(compId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.COMP_TABLE)
            .delete()
            .eq('id', compId);

        if (error) {
            console.error('[CompetitionRepository] deleteCompetition error:', error);
            return false;
        }
        return true;
    }

    // --- RIVALS ---

    async getRivalsByCompetition(compId: string): Promise<Rival[]> {
        const { data, error } = await this.supabase.instance
            .from(this.RIVAL_TABLE)
            .select('*')
            .eq('competition_id', compId)
            .order('name', { ascending: true });

        if (error) {
            console.error('[CompetitionRepository] getRivalsByCompetition error:', error);
            return [];
        }
        return data.map(this.mapRowToRival);
    }

    async createRival(compId: string, name: string, logoUrl?: string): Promise<Rival | null> {
        const { data, error } = await this.supabase.instance
            .from(this.RIVAL_TABLE)
            .insert([{ competition_id: compId, name, logo_url: logoUrl }])
            .select()
            .single();

        if (error || !data) {
            console.error('[CompetitionRepository] createRival error:', error);
            return null;
        }
        return this.mapRowToRival(data);
    }

    async updateRival(rivalId: string, updates: Partial<Rival>): Promise<Rival | null> {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;

        const { data, error } = await this.supabase.instance
            .from(this.RIVAL_TABLE)
            .update(payload)
            .eq('id', rivalId)
            .select()
            .single();

        if (error || !data) {
            console.error('[CompetitionRepository] updateRival error:', error);
            return null;
        }
        return this.mapRowToRival(data);
    }

    async deleteRival(rivalId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.RIVAL_TABLE)
            .delete()
            .eq('id', rivalId);

        if (error) {
            console.error('[CompetitionRepository] deleteRival error:', error);
            return false;
        }
        return true;
    }

    async findOrCreateRival(compId: string, name: string): Promise<Rival | null> {
        // Find first
        const { data: existing, error: findError } = await this.supabase.instance
            .from(this.RIVAL_TABLE)
            .select('*')
            .eq('competition_id', compId)
            .ilike('name', name)
            .maybeSingle();

        if (existing) return this.mapRowToRival(existing);

        // Or create
        return this.createRival(compId, name);
    }

    private mapRowToCompetition(row: any): Competition {
        return {
            id: row.id,
            teamId: row.team_id,
            name: row.name,
            season: row.season,
            createdAt: row.created_at
        };
    }

    private mapRowToRival(row: any): Rival {
        return {
            id: row.id,
            competitionId: row.competition_id,
            name: row.name,
            logoUrl: row.logo_url,
            createdAt: row.created_at
        };
    }
}
