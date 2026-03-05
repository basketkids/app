import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeamService, Team, FollowedTeam } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-home',
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class Home implements OnInit, OnDestroy {
    myTeams: Team[] = [];
    followedTeams: FollowedTeam[] = [];
    newTeamName = '';
    teamToDeleteId: string | null = null;
    loadingTeams = true;
    errorMsg = '';
    private channelSubscription: { unsubscribe: () => void } | null = null;

    constructor(
        private teamService: TeamService,
        public auth: AuthService
    ) {
        console.log('[Home] constructor called');
    }

    async ngOnInit(): Promise<void> {
        const userId = this.auth.currentSession?.user?.id;
        console.log('[Home] ngOnInit — currentSession:', this.auth.currentSession);
        console.log('[Home] ngOnInit — userId:', userId);

        if (!userId) {
            console.error('[Home] ❌ userId is undefined — session not ready when component initialized!');
            this.loadingTeams = false;
            this.errorMsg = 'No se pudo obtener el usuario. Recarga la página.';
            return;
        }

        try {
            // Direct await call — always runs in Angular zone, no NgZone needed
            const [teams, followed] = await Promise.all([
                this.teamService.getMyTeams(userId),
                this.teamService.getFollowedTeams(userId)
            ]);
            console.log('[Home] ✅ Teams loaded:', teams.length);
            console.log('[Home] ✅ Followed loaded:', followed.length);
            this.myTeams = teams;
            this.followedTeams = followed;
        } catch (e) {
            console.error('[Home] ❌ Error loading teams:', e);
            this.errorMsg = (e as Error).message;
        } finally {
            this.loadingTeams = false;
        }

        // Realtime subscription for live updates
        this.channelSubscription = this.teamService.subscribeToTeams(userId, (teams) => {
            // Update in background — view already loaded
            this.myTeams = [...teams];
        });
    }

    async addTeam(): Promise<void> {
        const userId = this.auth.currentSession?.user?.id;
        if (!userId || !this.newTeamName.trim()) return;
        try {
            await this.teamService.create(userId, this.newTeamName);
            this.newTeamName = '';
            // Close modal via Bootstrap JS
            const el = document.getElementById('addTeamModal');
            if (el) {
                const modal = (window as Window & { bootstrap?: { Modal: { getInstance: (el: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Modal.getInstance(el);
                modal?.hide();
            }
        } catch (e) {
            this.errorMsg = (e as Error).message;
        }
    }

    confirmDelete(teamId: string): void {
        this.teamToDeleteId = teamId;
    }

    async deleteTeam(): Promise<void> {
        if (!this.teamToDeleteId) return;
        try {
            await this.teamService.delete(this.teamToDeleteId);
            this.teamToDeleteId = null;
            const el = document.getElementById('confirmDeleteModal');
            if (el) {
                const modal = (window as Window & { bootstrap?: { Modal: { getInstance: (el: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Modal.getInstance(el);
                modal?.hide();
            }
        } catch (e) {
            this.errorMsg = (e as Error).message;
        }
    }

    ngOnDestroy(): void {
        this.channelSubscription?.unsubscribe();
    }
}
