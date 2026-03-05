import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️ Credentials sourced from old/js/supabase-config.js (the legacy app config)
// Move these to environment.ts for production deployments.
const SUPABASE_URL = 'https://geyzurfyfdhefpuinlqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dNlszvioiebQgq5_IiZ63A_YWdMNzRQ';

@Injectable({
    providedIn: 'root'
})
export class SupabaseDataClient {
    private client: SupabaseClient;

    constructor() {
        this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: true,
                detectSessionInUrl: true,
                storageKey: 'basketkids-v1-auth' // Same key as legacy to reuse existing sessions
            }
        });
    }

    get instance(): SupabaseClient {
        return this.client;
    }
}
