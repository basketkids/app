import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProfileRepository, UserProfile } from '../models/data/profile.repository';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
    private profileSubject = new BehaviorSubject<UserProfile | null>(null);
    readonly profile$: Observable<UserProfile | null> = this.profileSubject.asObservable();

    constructor(private auth: AuthService, private profileRepo: ProfileRepository) {
        // Automatically load profile when auth session changes
        this.auth.session$.subscribe(async session => {
            if (session?.user?.id) {
                await this.reloadProfile(session.user.id);
            } else {
                this.profileSubject.next(null);
            }
        });
    }

    get currentProfile(): UserProfile | null {
        return this.profileSubject.getValue();
    }

    async reloadProfile(userId?: string): Promise<void> {
        const id = userId || this.auth.currentSession?.user?.id;
        if (!id) return;

        try {
            const profile = await this.profileRepo.getProfile(id);
            this.profileSubject.next(profile);
        } catch (error) {
            console.error('[ProfileService] Failed to load profile:', error);
            this.profileSubject.next(null);
        }
    }
}
