import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    read: boolean;
    archived: boolean;
    created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ContactMessagesRepository {
    private readonly TABLE = 'contact_messages';

    constructor(private supabase: SupabaseDataClient) { }

    async getMessages(): Promise<ContactMessage[]> {
        const { data, error } = await this.supabase.instance
            .from(this.TABLE)
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }

    async sendMessage(payload: Pick<ContactMessage, 'name' | 'email' | 'phone' | 'message'>): Promise<void> {
        const { error } = await this.supabase.instance
            .from(this.TABLE)
            .insert([{ ...payload, read: false, archived: false }]);
        if (error) throw error;
    }

    async markAsRead(id: string): Promise<void> {
        const { error } = await this.supabase.instance.from(this.TABLE).update({ read: true }).eq('id', id);
        if (error) throw error;
    }

    async archive(id: string): Promise<void> {
        const { error } = await this.supabase.instance.from(this.TABLE).update({ archived: true }).eq('id', id);
        if (error) throw error;
    }

    async unarchive(id: string): Promise<void> {
        const { error } = await this.supabase.instance.from(this.TABLE).update({ archived: false }).eq('id', id);
        if (error) throw error;
    }

    async getUnreadCount(): Promise<number> {
        const { count, error } = await this.supabase.instance
            .from(this.TABLE)
            .select('*', { count: 'exact', head: true })
            .eq('read', false)
            .eq('archived', false);
        if (error) throw error;
        return count ?? 0;
    }
}
