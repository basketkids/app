import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';

export interface AvatarConfig {
    id?: string;
    skin_color?: string;
    top?: string;
    hair_color?: string;
    hat_color?: string;
    facial_hair_type?: string;
    facial_hair_color?: string;
    eyes?: string;
    eyebrows?: string;
    mouth?: string;
    accessories_type?: string;
    accessories_color?: string;
    clothing?: string;
    clothes_color?: string;
    clothing_graphic?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AvatarConfigRepository {
    private readonly TABLE_NAME = 'avatar_configs';

    constructor(private supabase: SupabaseDataClient) { }

    async getConfigById(id: string): Promise<AvatarConfig | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('[AvatarConfigRepository] getConfigById error:', error);
            return null;
        }
        return data as AvatarConfig;
    }

    async upsertConfig(config: AvatarConfig, existingId?: string | null): Promise<string | null> {
        const payload = existingId ? { ...config, id: existingId } : config;

        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .upsert([payload])
            .select('id')
            .single();

        if (error) {
            console.error('[AvatarConfigRepository] upsertConfig error:', error);
            return null;
        }

        return data?.id || existingId || null;
    }

    async deleteConfig(id: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[AvatarConfigRepository] deleteConfig error:', error);
            return false;
        }

        return true;
    }
}
