import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeamService, Team, FollowedTeam } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-home',
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './home.html',
    styleUrls: []
})
export class Home implements OnInit, OnDestroy {
    myTeams: Team[] = [];
    followedTeams: FollowedTeam[] = [];
    newTeamName = '';
    teamToDeleteId: string | null = null;
    loadingTeams = true;
    errorMsg = '';

    // Modal State Flags
    showAddTeamModal = false;
    showDeleteTeamModal = false;

    private channelSubscription: { unsubscribe: () => void } | null = null;

    constructor(
        private teamService: TeamService,
        public auth: AuthService
    ) {
    }

    async ngOnInit(): Promise<void> {
        const userId = this.auth.currentSession?.user?.id;

        if (!userId) {
            this.loadingTeams = false;
            this.errorMsg = 'No se pudo obtener el usuario. Recarga la página.';
            return;
        }

        try {
            const [teams, followed] = await Promise.all([
                this.teamService.getMyTeams(userId),
                this.teamService.getFollowedTeams(userId)
            ]);
            this.myTeams = teams;
            this.followedTeams = followed;
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loadingTeams = false;
        }

        this.channelSubscription = this.teamService.subscribeToTeams(userId, (teams) => {
            this.myTeams = [...teams];
        });
    }

    async addTeam(): Promise<void> {
        const userId = this.auth.currentSession?.user?.id;
        if (!userId || !this.newTeamName.trim()) return;
        try {
            await this.teamService.create(userId, this.newTeamName);
            this.newTeamName = '';
            this.showAddTeamModal = false;
        } catch (e) {
            this.errorMsg = (e as Error).message;
        }
    }

    confirmDelete(teamId: string, event: Event): void {
        event.stopPropagation();
        this.teamToDeleteId = teamId;
        this.showDeleteTeamModal = true;
    }

    async deleteTeam(): Promise<void> {
        if (!this.teamToDeleteId) return;
        try {
            await this.teamService.delete(this.teamToDeleteId);
            this.teamToDeleteId = null;
            this.showDeleteTeamModal = false;
        } catch (e) {
            this.errorMsg = (e as Error).message;
        }
    }

    ngOnDestroy(): void {
        this.channelSubscription?.unsubscribe();
    }
}
