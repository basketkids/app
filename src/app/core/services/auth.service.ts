import { Injectable } from '@angular/core';
import { AuthRepository, AppSession } from '../models/data/auth.repository';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private sessionSubject = new BehaviorSubject<AppSession | null>(null);
    readonly session$: Observable<AppSession | null> = this.sessionSubject.asObservable();

    // Emits exactly once after getSession() resolves (fixes page-reload race condition in authGuard)
    private sessionReadySubject = new ReplaySubject<AppSession | null>(1);
    readonly sessionReady$: Observable<AppSession | null> = this.sessionReadySubject.asObservable();

    constructor(private authRepo: AuthRepository) {
        console.log('[Auth] Initializing AuthService...');

        // Initialize with current session
        this.authRepo.getSession().then(({ session, error }) => {
            if (error) {
                console.error('[Auth] Error getting session:', error);
            } else if (session) {
                console.log('[Auth] ✅ Session restored:', session.user.email, '| expires:', session.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : 'N/A');
            } else {
                console.log('[Auth] ℹ️ No active session (user not logged in)');
            }
            this.sessionSubject.next(session);
            // Signal that initialization is done (authGuard waits for this)
            this.sessionReadySubject.next(session);
        });

        // Reactively update on auth state changes
        this.authRepo.onAuthStateChange(
            (event: string, session: AppSession | null) => {
                console.log(`[Auth] 🔄 Auth state changed: ${event}`, session ? `→ ${session.user.email}` : '→ null');
                this.sessionSubject.next(session);
            }
        );
    }

    get currentSession(): AppSession | null {
        return this.sessionSubject.getValue();
    }

    isLoggedIn(): boolean {
        return !!this.currentSession;
    }

    async signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
        console.log('[Auth] Attempting email login for:', email);
        const { userEmail, error } = await this.authRepo.signInWithPassword(email, password);
        if (error) {
            console.error('[Auth] ❌ Email login failed:', error);
        } else {
            console.log('[Auth] ✅ Email login success:', userEmail);
        }
        return { error };
    }

    async signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
        console.log('[Auth] Attempting sign up for:', email);
        const { hasSession, error } = await this.authRepo.signUp(email, password);
        if (error) {
            console.error('[Auth] ❌ Sign up failed:', error);
            return { error, needsConfirmation: false };
        }
        console.log('[Auth] ✅ Sign up result — session:', hasSession ? 'active' : 'needs email confirmation');
        return { error: null, needsConfirmation: !hasSession };
    }

    async signInWithGoogle(): Promise<{ error: string | null }> {
        const redirectTo = window.location.origin + '/auth/callback';
        console.log('[Auth] Google OAuth — redirectTo:', redirectTo);
        const { url, error } = await this.authRepo.signInWithOAuthGoogle(redirectTo);
        if (error) {
            console.error('[Auth] ❌ Google OAuth error:', error);
        } else {
            console.log('[Auth] ✅ Google OAuth initiated — redirect URL:', url);
        }
        return { error };
    }

    async resetPassword(email: string): Promise<{ error: string | null }> {
        const redirectTo = window.location.origin + '/reset-password';
        console.log('[Auth] Password reset for:', email, '| redirectTo:', redirectTo);
        const { error } = await this.authRepo.resetPasswordForEmail(email, redirectTo);
        if (error) {
            console.error('[Auth] ❌ Password reset error:', error);
        } else {
            console.log('[Auth] ✅ Password reset email sent');
        }
        return { error };
    }

    async signOut(): Promise<void> {
        console.log('[Auth] Signing out:', this.currentSession?.user.email);
        await this.authRepo.signOut();
        this.sessionSubject.next(null);
        console.log('[Auth] ✅ Signed out');
    }
}
