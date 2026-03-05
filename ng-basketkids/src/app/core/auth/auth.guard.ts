import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Wait for getSession() to resolve before deciding — fixes page-reload race condition
    return auth.sessionReady$.pipe(
        take(1),
        map(session => {
            if (session) {
                return true;
            }
            console.log('[AuthGuard] No session after init → redirecting to /login');
            return router.createUrlTree(['/login']);
        })
    );
};
