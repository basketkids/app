import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { Player } from '../player.model';

@Injectable({
    providedIn: 'root'
})
export class PlayerRepository {
    private readonly TABLE_NAME = 'players';

    constructor(private supabase: SupabaseDataClient) { }

    async getPlayersByTeam(teamId: string): Promise<Player[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .eq('team_id', teamId);

        if (error) {
            console.error('[PlayerRepository] getPlayersByTeam error:', error);
            return [];
        }

        return data.map(this.mapRowToPlayer);
    }

    async getPlayerById(playerId: string): Promise<Player | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', playerId)
            .single();

        if (error || !data) {
            console.error('[PlayerRepository] getPlayerById error:', error);
            return null;
        }

        return this.mapRowToPlayer(data);
    }

    async createPlayer(teamId: string, player: Partial<Player>): Promise<Player | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .insert([{
                team_id: teamId,
                name: player.name,
                number: player.dorsal?.toString() || '',
                // Map other fields if needed, like birth_date, height, etc.
            }])
            .select()
            .single();

        if (error || !data) {
            console.error('[PlayerRepository] createPlayer error:', error);
            return null;
        }

        return this.mapRowToPlayer(data);
    }

    async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player | null> {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.dorsal !== undefined) payload.number = updates.dorsal?.toString();
        // and other fields...

        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .update(payload)
            .eq('id', playerId)
            .select()
            .single();

        if (error || !data) {
            console.error('[PlayerRepository] updatePlayer error:', error);
            return null;
        }

        return this.mapRowToPlayer(data);
    }

    async deletePlayer(playerId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', playerId);

        if (error) {
            console.error('[PlayerRepository] deletePlayer error:', error);
            return false;
        }

        return true;
    }

    private mapRowToPlayer(row: any): Player {
        return {
            id: row.id,
            name: row.name,
            dorsal: parseInt(row.number, 10) || 0,
            avatarConfig: row.avatar_config_id || null
        } as Player;
    }
}
