import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupabaseDataClient {
    private client: SupabaseClient;

    constructor() {
        this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: true,
                detectSessionInUrl: true,
                storageKey: environment.supabaseAuthStorageKey // Same key as legacy to reuse existing sessions
            }
        });
    }

    get instance(): SupabaseClient {
        return this.client;
    }
}
