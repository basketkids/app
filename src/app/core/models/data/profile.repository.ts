import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';
import { AvatarConfig } from './avatar-config.repository';

export interface PublicitySettings {
    stats: boolean;
    events: boolean;
    chronicle: boolean;
    fantasy: boolean;
    leaders: boolean;
    mvp: boolean;
}

export interface UserProfile {
    id: string; // the UUID matching auth.users
    email: string | null;
    display_name: string;
    photo_url: string | null;
    is_admin: boolean;
    avatar_config_id: string | null;
    avatar_configs?: AvatarConfig | null; // Joined profile config
    publicity_settings?: PublicitySettings | null;
    updated_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProfileRepository {
    private readonly TABLE_NAME = 'profiles';

    constructor(private supabase: SupabaseDataClient) { }

    /**
     * Get the profile by User UUID, joining the avatar settings.
     */
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*, avatar_configs(*)')
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.error('[ProfileRepository] getProfile error:', error);
            return null;
        }

        let ac = data.avatar_configs;
        if (Array.isArray(ac)) ac = ac[0];

        return { ...data, avatar_configs: ac } as UserProfile;
    }

    /**
     * Get all admins (used in the About page)
     */
    async getAdmins(): Promise<UserProfile[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*, avatar_configs(*)')
            .eq('is_admin', true);

        if (error || !data) {
            console.error('[ProfileRepository] getAdmins error:', error);
            return [];
        }

        return data.map(d => {
            let ac = d.avatar_configs;
            if (Array.isArray(ac)) ac = ac[0];
            return { ...d, avatar_configs: ac } as UserProfile;
        });
    }

    /**
     * Update the profile fields.
     */
    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
        const payload = { ...updates };
        delete payload.avatar_configs;
        payload.updated_at = new Date().toISOString();
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .upsert({ id: userId, ...payload });
        if (error) { console.error('[ProfileRepository] updateProfile error:', error); return false; }
        return true;
    }

    /**
     * Update the profile fields. Note: avatar_config modifications should be 
     * done using the AvatarConfigRepository, then linked by setting `avatar_config_id`.
     */
    /**
     * Get all profiles (admin use)
     */
    async getAllProfiles(): Promise<UserProfile[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .select('*')
            .order('display_name', { ascending: true });
        if (error) { console.error('[ProfileRepository] getAllProfiles error:', error); return []; }
        return data as UserProfile[];
    }

    /**
     * Set admin status for a user (admin use)
     */
    async setAdminStatus(userId: string, isAdmin: boolean): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .update({ is_admin: isAdmin })
            .eq('id', userId);
        if (error) { console.error('[ProfileRepository] setAdminStatus error:', error); return false; }
        return true;
    }

    /**
     * Update just the display name (admin use)
     */
    async updateDisplayName(userId: string, displayName: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .update({ display_name: displayName })
            .eq('id', userId);
        if (error) { console.error('[ProfileRepository] updateDisplayName error:', error); return false; }
        return true;
    }

    /**
     * Delete a profile (admin use — cascades on DB)
     */
    async deleteProfile(userId: string): Promise<boolean> {
        const { error } = await this.supabase.instance
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', userId);
        if (error) { console.error('[ProfileRepository] deleteProfile error:', error); return false; }
        return true;
    }
}

