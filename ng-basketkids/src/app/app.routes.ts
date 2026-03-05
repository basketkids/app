import { Routes } from '@angular/router';
import { Login } from './features/login/login';
import { Home } from './features/home/home';
import { Equipo } from './features/equipo/equipo';
import { Competitions } from './features/competitions/competitions';
import { AdminMatch } from './features/admin-match/admin-match';
import { PublicMatch } from './features/public-match/public-match';
import { AuthCallback } from './features/auth-callback/auth-callback';
import { Calendario } from './features/calendario/calendario';
import { PublicMatches } from './features/public-matches/public-matches';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'login', component: Login },

    // OAuth callback — NO guard
    { path: 'auth/callback', component: AuthCallback },

    // Protected routes
    { path: 'home', component: Home, canActivate: [authGuard] },
    { path: 'equipo/:id', component: Equipo, canActivate: [authGuard] },
    { path: 'competicion/:id', component: Competitions, canActivate: [authGuard] },
    { path: 'partido-admin/:id', component: AdminMatch, canActivate: [authGuard] },
    { path: 'calendario', component: Calendario, canActivate: [authGuard] },

    // Public routes — no login required
    { path: 'partidos-publicos', component: PublicMatches },
    { path: 'partido/:id', component: PublicMatch },

    { path: '**', redirectTo: 'home' }
];
