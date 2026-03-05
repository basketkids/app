import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TeamService, Team } from '../../core/services/team.service';
import { PlayerService, Player } from '../../core/services/player.service';
import { CompetitionService, Competition } from '../../core/services/competition.service';
import { AuthService } from '../../core/services/auth.service';

type TeamTab = 'plantilla' | 'competiciones' | 'miembros' | 'fantasy';

@Component({
    selector: 'app-equipo',
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './equipo.html',
    styleUrls: ['./equipo.css']
})
export class Equipo implements OnInit {
    team: Team | null = null;
    players: Player[] = [];
    competitions: Competition[] = [];
    activeTab: TeamTab = 'plantilla';

    newPlayer = { name: '', dorsal: '' };
    newCompetitionName = '';
    errorMsg = '';
    loading = true;
    teamId = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private teamService: TeamService,
        private playerService: PlayerService,
        private competitionService: CompetitionService,
        public auth: AuthService
    ) { }

    ngOnInit(): void {
        this.teamId = this.route.snapshot.paramMap.get('id') ?? '';
        this.loadAll();
    }

    private async loadAll(): Promise<void> {
        try {
            const userId = this.auth.currentSession?.user?.id ?? '';
            const allTeams = await this.teamService.getMyTeams(userId);
            this.team = allTeams.find(t => t.id === this.teamId) ?? null;
            [this.players, this.competitions] = await Promise.all([
                this.playerService.getSquad(this.teamId),
                this.loadCompetitions()
            ]);
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loading = false;
        }
    }

    private async loadCompetitions(): Promise<Competition[]> {
        return this.competitionService.getCompetitionsByTeam(this.teamId);
    }

    async addPlayer(): Promise<void> {
        if (!this.newPlayer.name.trim()) return;
        try {
            await this.playerService.add(this.teamId, this.newPlayer.name.trim(), this.newPlayer.dorsal.trim());
            this.newPlayer = { name: '', dorsal: '' };
            this.players = await this.playerService.getSquad(this.teamId);
            this.closeModal('addPlayerModal');
        } catch (e) { this.errorMsg = (e as Error).message; }
    }

    async deletePlayer(playerId: string): Promise<void> {
        if (!confirm('¿Borrar este jugador/a?')) return;
        await this.playerService.delete(playerId);
        this.players = await this.playerService.getSquad(this.teamId);
    }

    async addCompetition(): Promise<void> {
        if (!this.newCompetitionName.trim()) return;
        try {
            await this.competitionService.createCompetition(this.teamId, this.newCompetitionName.trim());
            this.newCompetitionName = '';
            this.competitions = await this.loadCompetitions();
            this.closeModal('addCompeticionModal');
        } catch (e) { this.errorMsg = (e as Error).message; }
    }

    goToCompetition(compId: string): void {
        this.router.navigate(['/competicion', compId]);
    }

    private closeModal(id: string): void {
        const el = document.getElementById(id);
        if (el) {
            const modal = (window as Window & { bootstrap?: { Modal: { getInstance: (el: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Modal.getInstance(el);
            modal?.hide();
        }
    }
}
