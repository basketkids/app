import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TeamService, Team } from '../../core/services/team.service';
import { PlayerService, Player } from '../../core/services/player.service';
import { CompetitionService, Competition } from '../../core/services/competition.service';
import { AuthService } from '../../core/services/auth.service';
import { Avatar } from '../../shared/components/avatar/avatar';
import { AvatarEditor } from '../../shared/components/avatar-editor/avatar-editor';
import { MatchRepository, MatchScore, PlayerMatchLog } from '../../core/models/data/match.repository';
import { LeadersChartComponent, PlayerStatRow } from '../../shared/components/leaders-chart/leaders-chart';
import { EvolutionChartComponent } from '../../shared/components/evolution-chart/evolution-chart';
import { PlayerSparklineComponent, SparklineSeries } from '../../shared/components/player-sparkline/player-sparkline';

type TeamTab = 'plantilla' | 'competiciones' | 'miembros' | 'fantasy' | 'destacados' | 'evolucion';

@Component({
    selector: 'app-equipo',
    imports: [CommonModule, FormsModule, RouterModule, Avatar, AvatarEditor, LeadersChartComponent, EvolutionChartComponent, PlayerSparklineComponent],
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

    editingPlayer: Player | null = null;
    editingAvatarConfig: import('../../core/models/data/avatar-config.repository').AvatarConfig = {};

    // Modal state flags
    showAddPlayerModal = false;
    showEditPlayerModal = false;
    showDeletePlayerModal = false;
    showAddCompetitionModal = false;
    showEditTeamModal = false;
    showPlayerDetailsModal = false;
    playerToDeleteId: string | null = null;
    selectedPlayer: Player | null = null;
    selectedPlayerMatchLog: PlayerMatchLog[] = [];
    playerDetailsLoading = false;
    playerSparklineSeries: SparklineSeries[] = [];

    editTeamData = { name: '', coach: '', jerseyColor: '' };

    readonly DICEBEAR_COLORS = [
        { name: 'Rojo', hex: 'ff5c5c' },
        { name: 'Naranja', hex: 'ffdeb5' },
        { name: 'Amarillo', hex: 'ffffb1' },
        { name: 'Verde', hex: 'a7ffc4' },
        { name: 'Azul', hex: '5199e4' },
        { name: 'Azul Claro', hex: '65c9ff' },
        { name: 'Azul Oscuro', hex: '25557c' },
        { name: 'Rosa', hex: 'ff488e' },
        { name: 'Morado', hex: 'ffafb9' },
        { name: 'Gris', hex: 'e6e6e6' },
        { name: 'Gris Oscuro', hex: '929598' },
        { name: 'Negro', hex: '262e33' },
        { name: 'Blanco', hex: 'ffffff' }
    ];

    // Aggregate stats
    statRows: PlayerStatRow[] = [];
    statSortCol: keyof PlayerStatRow = 'vpg';
    statSortAsc = false;
    statsLoading = false;
    matchScores: MatchScore[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private teamService: TeamService,
        private playerService: PlayerService,
        private competitionService: CompetitionService,
        public auth: AuthService,
        private matchRepo: MatchRepository
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
            this.loadAggregateStats();
            this.matchRepo.getMatchScoresByTeam(this.teamId).then(s => { this.matchScores = s; });
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loading = false;
        }
    }

    async loadAggregateStats(): Promise<void> {
        this.statsLoading = true;
        try {
            const raw = await this.matchRepo.getAggregateStatsByTeam(this.teamId);
            this.statRows = raw.map(r => {
                const gp = r.gamesPlayed || 1;
                const ppg = r.totalPoints / gp;
                const apg = r.totalAssists / gp;
                const rpg = r.totalRebounds / gp;
                const spg = r.totalSteals / gp;
                const bpg = r.totalBlocks / gp;
                const fpg = r.totalFouls / gp;
                const vpg = r.totalValoracion / gp;
                // Fantasy (legacy NBA formula): PTS×1 + REB×1 + AST×2 + ROB×3 + TAP×3
                const fantasyTotal = r.totalPoints * 1 + r.totalRebounds * 1 + r.totalAssists * 2 + r.totalSteals * 3 + r.totalBlocks * 3;
                const fantasyPpg = r.gamesPlayed > 0 ? fantasyTotal / r.gamesPlayed : 0;
                return { ...r, ppg, apg, rpg, spg, bpg, fpg, vpg, fantasyTotal, fantasyPpg };
            });
            this.sortStats();
        } finally {
            this.statsLoading = false;
        }
    }

    sortStats(col?: keyof PlayerStatRow): void {
        if (col) {
            if (this.statSortCol === col) this.statSortAsc = !this.statSortAsc;
            else { this.statSortCol = col; this.statSortAsc = false; }
        }
        this.statRows = [...this.statRows].sort((a, b) => {
            const va = a[this.statSortCol] as any;
            const vb = b[this.statSortCol] as any;
            if (typeof va === 'string') return this.statSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return this.statSortAsc ? va - vb : vb - va;
        });

        // The HTML table iterates over `players`, so we must sort `players` too
        const m = this.statsMap;
        this.players = [...this.players].sort((a, b) => {
            const statA = m[a.id];
            const statB = m[b.id];
            // Push players with no stats to the bottom
            if (!statA && !statB) return a.name.localeCompare(b.name);
            if (!statA) return 1;
            if (!statB) return -1;

            const va = statA[this.statSortCol] as any;
            const vb = statB[this.statSortCol] as any;
            if (typeof va === 'string') return this.statSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return this.statSortAsc ? va - vb : vb - va;
        });
    }

    get fantasySorted(): PlayerStatRow[] {
        return [...this.statRows].sort((a, b) => b.fantasyPpg - a.fantasyPpg);
    }

    fmt(n: number): string { return n.toFixed(1); }

    get statsMap(): Record<string, PlayerStatRow> {
        const m: Record<string, PlayerStatRow> = {};
        this.statRows.forEach(r => { m[r.playerId] = r; });
        return m;
    }

    private async loadCompetitions(): Promise<Competition[]> {
        return this.competitionService.getCompetitionsByTeam(this.teamId);
    }

    matchesForComp(compId: string): MatchScore[] {
        return this.matchScores.filter(m => m.competitionId === compId);
    }

    async addPlayer(): Promise<void> {
        if (!this.newPlayer.name.trim()) return;
        try {
            await this.playerService.add(this.teamId, this.newPlayer.name.trim(), this.newPlayer.dorsal.trim());
            this.newPlayer = { name: '', dorsal: '' };
            this.players = await this.playerService.getSquad(this.teamId);
            this.showAddPlayerModal = false;
        } catch (e) { this.errorMsg = (e as Error).message; }
    }

    openEditPlayer(player: Player): void {
        this.editingPlayer = { ...player };
        this.editingAvatarConfig = { ...(player.avatarConfig || {}) } as any;
        this.showEditPlayerModal = true;
    }

    onAvatarConfigChange(config: any): void {
        this.editingAvatarConfig = config;
    }

    async savePlayer(): Promise<void> {
        if (!this.editingPlayer) return;
        try {
            const existingConfigId = this.editingPlayer.avatarConfig?.['id'] as string | undefined;
            await this.playerService.updatePlayerAndAvatar(
                this.editingPlayer.id,
                { name: this.editingPlayer.name, dorsal: this.editingPlayer.dorsal as any },
                this.editingAvatarConfig,
                existingConfigId
            );
            this.players = await this.playerService.getSquad(this.teamId);
            this.showEditPlayerModal = false;
        } catch (e) { this.errorMsg = (e as Error).message; }
    }

    confirmDeletePlayer(playerId: string): void {
        this.playerToDeleteId = playerId;
        this.showDeletePlayerModal = true;
    }

    async deletePlayer(): Promise<void> {
        if (!this.playerToDeleteId) return;
        await this.playerService.delete(this.playerToDeleteId);
        this.players = await this.playerService.getSquad(this.teamId);
        this.showDeletePlayerModal = false;
    }

    async addCompetition(): Promise<void> {
        if (!this.newCompetitionName.trim()) return;
        try {
            await this.competitionService.createCompetition(this.teamId, this.newCompetitionName.trim());
            this.newCompetitionName = '';
            this.competitions = await this.loadCompetitions();
            this.showAddCompetitionModal = false;
        } catch (e) { this.errorMsg = (e as Error).message; }
    }

    goToCompetition(compId: string): void {
        this.router.navigate(['/competicion', compId]);
    }

    openEditTeam(): void {
        this.editTeamData = {
            name: this.team?.name || '',
            coach: this.team?.coach || '',
            jerseyColor: this.team?.jerseyColor || '5199e4'
        };
        this.showEditTeamModal = true;
    }

    async openPlayerDetails(player: Player): Promise<void> {
        this.selectedPlayer = player;
        this.showPlayerDetailsModal = true;
        this.playerDetailsLoading = true;
        this.selectedPlayerMatchLog = [];
        this.playerSparklineSeries = [];
        try {
            this.selectedPlayerMatchLog = await this.matchRepo.getPlayerMatchLog(player.id);
            this.buildPlayerSparklines();
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.playerDetailsLoading = false;
        }
    }

    private buildPlayerSparklines(): void {
        const log = this.selectedPlayerMatchLog;
        if (!log.length) { this.playerSparklineSeries = []; return; }
        const dates = log.map(m => m.dateStr);
        this.playerSparklineSeries = [
            { label: 'Puntos', color: '#f97316', values: log.map(m => m.points), dates },
            { label: 'Valoración', color: '#a855f7', values: log.map(m => m.valoracion), dates },
            { label: 'Rebotes', color: '#3b82f6', values: log.map(m => m.rebounds), dates },
            { label: 'Asistencias', color: '#22c55e', values: log.map(m => m.assists), dates },
        ].filter(s => s.values.some(v => v > 0));
    }

    getCompetitionName(compId?: string): string {
        if (!compId) return 'Amistoso';
        const c = this.competitions.find(x => x.id === compId);
        return c ? c.name : 'Amistoso';
    }

    async saveTeamSettings(): Promise<void> {
        if (!this.team) return;
        try {
            await this.teamService.updateTeam(this.team.id, {
                name: this.editTeamData.name.trim(),
                coach: this.editTeamData.coach.trim() || null as any,
                jerseyColor: this.editTeamData.jerseyColor.trim() || '5199e4'
            });
            this.team = await this.teamService.getTeam(this.team.id);
            this.showEditTeamModal = false;
        } catch (e) {
            this.errorMsg = (e as Error).message;
        }
    }
}
