import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Component({
    selector: 'app-auth-callback',
    imports: [CommonModule],
    template: `
        <div class="d-flex align-items-center justify-content-center" style="min-height:100vh">
            <div class="text-center">
                <div class="spinner-border text-primary mb-3"></div>
                <p class="text-muted">Completando autenticación...</p>
                <p *ngIf="error" class="text-danger small">{{ error }}</p>
            </div>
        </div>
    `
})
export class AuthCallback implements OnInit, OnDestroy {
    error = '';
    private sub?: Subscription;
    private timeout?: ReturnType<typeof setTimeout>;

    constructor(private auth: AuthService, private router: Router) { }

    ngOnInit(): void {
        console.log('[AuthCallback] Waiting for session from detectSessionInUrl...');

        // detectSessionInUrl:true handles both implicit (#access_token) and PKCE (?code) flows.
        // Just wait for a non-null session and navigate.
        this.sub = this.auth.session$.pipe(
            filter(s => s !== null),
            take(1)
        ).subscribe(session => {
            console.log('[AuthCallback] ✅ Session received:', session!.user.email);
            this.router.navigate(['/home']);
        });

        // Fallback: if no session within 5s, go to login
        this.timeout = setTimeout(() => {
            if (!this.auth.isLoggedIn()) {
                console.warn('[AuthCallback] ⚠️ Timeout — no session received, redirecting to login');
                this.error = 'No se pudo completar la autenticación';
                setTimeout(() => this.router.navigate(['/login']), 1500);
            }
        }, 5000);
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
        if (this.timeout) clearTimeout(this.timeout);
    }
}
