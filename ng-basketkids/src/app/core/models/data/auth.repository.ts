import { Injectable } from '@angular/core';
import { SupabaseDataClient } from './supabase.client';

export interface AppUser {
    id: string;
    email?: string;
}

export interface AppSession {
    user: AppUser;
    expires_at?: number;
}

@Injectable({
    providedIn: 'root'
})
export class AuthRepository {
    constructor(private supabase: SupabaseDataClient) { }

    async getSession(): Promise<{ session: AppSession | null; error: string | null }> {
        const { data, error } = await this.supabase.instance.auth.getSession();

        let session: AppSession | null = null;
        if (data.session) {
            session = {
                user: {
                    id: data.session.user.id,
                    email: data.session.user.email
                },
                expires_at: data.session.expires_at
            };
        }

        return { session, error: error?.message ?? null };
    }

    onAuthStateChange(callback: (event: string, session: AppSession | null) => void): { unsubscribe: () => void } {
        const { data: { subscription } } = this.supabase.instance.auth.onAuthStateChange((event, cbSession) => {
            let session: AppSession | null = null;
            if (cbSession) {
                session = {
                    user: {
                        id: cbSession.user.id,
                        email: cbSession.user.email
                    },
                    expires_at: cbSession.expires_at
                };
            }
            callback(event, session);
        });

        return {
            unsubscribe: () => {
                subscription.unsubscribe();
            }
        };
    }

    async signInWithPassword(email: string, password: string): Promise<{ userEmail: string | null; error: string | null }> {
        const { data, error } = await this.supabase.instance.auth.signInWithPassword({ email, password });
        return { userEmail: data.user?.email ?? null, error: error?.message ?? null };
    }

    async signUp(email: string, password: string): Promise<{ hasSession: boolean; error: string | null }> {
        const { data, error } = await this.supabase.instance.auth.signUp({
            email,
            password,
            options: { data: { full_name: email.split('@')[0] } }
        });
        return { hasSession: !!data.session, error: error?.message ?? null };
    }

    async signInWithOAuthGoogle(redirectTo: string): Promise<{ url?: string; error: string | null }> {
        const { data, error } = await this.supabase.instance.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
        });
        return { url: data?.url ?? undefined, error: error?.message ?? null };
    }

    async resetPasswordForEmail(email: string, redirectTo: string): Promise<{ error: string | null }> {
        const { error } = await this.supabase.instance.auth.resetPasswordForEmail(email, { redirectTo });
        return { error: error?.message ?? null };
    }

    async signOut(): Promise<void> {
        await this.supabase.instance.auth.signOut();
    }
}
