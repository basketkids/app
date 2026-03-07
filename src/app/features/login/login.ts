import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-login',
    imports: [CommonModule, FormsModule],
    templateUrl: './login.html',
    styleUrls: ['./login.css']
})
export class Login {
    // Login tab
    loginEmail = '';
    loginPassword = '';

    // Register tab
    registerEmail = '';
    registerPassword = '';
    registerConfirmPassword = '';

    // Forgot password
    resetEmail = '';
    resetMessage = '';
    resetMessageType: 'success' | 'danger' = 'success';

    errorMsg = '';
    loading = false;
    activeTab: 'login' | 'register' | 'forgot' = 'login';

    constructor(private auth: AuthService, private router: Router) {
        if (this.auth.isLoggedIn()) {
            this.router.navigate(['/']);
        }
    }

    async onLogin(): Promise<void> {
        this.errorMsg = '';
        this.loading = true;
        const { error } = await this.auth.signInWithEmail(this.loginEmail, this.loginPassword);
        this.loading = false;
        if (error) {
            this.errorMsg = error;
        } else {
            this.router.navigate(['/']);
        }
    }

    async onRegister(): Promise<void> {
        this.errorMsg = '';
        if (this.registerPassword !== this.registerConfirmPassword) {
            this.errorMsg = 'Las contraseñas no coinciden';
            return;
        }
        this.loading = true;
        const { error, needsConfirmation } = await this.auth.signUp(this.registerEmail, this.registerPassword);
        this.loading = false;
        if (error) {
            this.errorMsg = error;
        } else if (needsConfirmation) {
            this.errorMsg = 'Registro exitoso. Por favor, confirma tu correo electrónico.';
        } else {
            this.router.navigate(['/']);
        }
    }

    async onGoogleLogin(): Promise<void> {
        this.errorMsg = '';
        const { error } = await this.auth.signInWithGoogle();
        if (error) {
            this.errorMsg = error;
        }
    }

    async onResetPassword(): Promise<void> {
        this.resetMessage = '';
        const { error } = await this.auth.resetPassword(this.resetEmail);
        if (error) {
            this.resetMessage = error;
            this.resetMessageType = 'danger';
        } else {
            this.resetMessage = 'Enlace enviado. Revisa tu correo.';
            this.resetMessageType = 'success';
        }
    }
}
