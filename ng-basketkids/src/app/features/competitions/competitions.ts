import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CompetitionService, Competition, Match, Rival, MatchState } from '../../core/services/competition.service';
import { AuthService } from '../../core/services/auth.service';
import { MatchRepository, MatchScore } from '../../core/models/data/match.repository';
import { LeadersChartComponent } from '../../shared/components/leaders-chart/leaders-chart';
import { PlayerStatRow } from '../../shared/components/leaders-chart/leaders-chart';
import { EvolutionChartComponent } from '../../shared/components/evolution-chart/evolution-chart';

@Component({
  selector: 'app-competitions',
  imports: [CommonModule, FormsModule, RouterModule, LeadersChartComponent, EvolutionChartComponent],
  templateUrl: './competitions.html',
  styleUrls: ['./competitions.css']
})
export class Competitions implements OnInit {
  competition: Competition | null = null;
  matches: Match[] = [];
  rivals: Rival[] = [];
  activeTab: 'partidos' | 'rivales' | 'destacados' | 'evolucion' = 'partidos';

  // Leaders data
  statRows: PlayerStatRow[] = [];
  matchScores: MatchScore[] = [];
  statsLoading = false;

  // New match form
  newMatch = { rival_name: '', date: '', venue: '', is_local: true };
  // New rival form
  newRivalName = '';

  // Modal State flags
  showAddMatchModal = false;
  showAddRivalModal = false;
  showDeleteMatchModal = false;
  showDeleteRivalModal = false;
  matchToDeleteId: string | null = null;
  rivalToDeleteId: string | null = null;

  errorMsg = '';
  loading = true;

  private compId = '';
  public teamId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private compService: CompetitionService,
    public auth: AuthService,
    private matchRepo: MatchRepository
  ) { }

  ngOnInit(): void {
    this.compId = this.route.snapshot.paramMap.get('id') ?? '';
    this.teamId = this.auth.currentSession?.user?.id ?? '';
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      [this.competition, this.matches, this.rivals] = await Promise.all([
        this.compService.getCompetition(this.compId),
        this.compService.getMatches(this.compId),
        this.compService.getRivals(this.compId)
      ]);
      this.loadLeaders();
    } catch (e) {
      this.errorMsg = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async loadLeaders(): Promise<void> {
    this.statsLoading = true;
    try {
      const [rawStats, scores] = await Promise.all([
        this.matchRepo.getAggregateStatsByCompetition(this.compId),
        this.matchRepo.getMatchScoresByCompetition(this.compId),
      ]);
      this.matchScores = scores;
      this.statRows = rawStats.map(r => {
        const gp = r.gamesPlayed || 1;
        const fantasyTotal = r.totalPoints * 1 + r.totalRebounds * 1 + r.totalAssists * 2 + r.totalSteals * 3 + r.totalBlocks * 3;
        return {
          ...r, ppg: r.totalPoints / gp, apg: r.totalAssists / gp, rpg: r.totalRebounds / gp,
          spg: r.totalSteals / gp, bpg: r.totalBlocks / gp, fpg: r.totalFouls / gp,
          vpg: r.totalValoracion / gp, fantasyTotal, fantasyPpg: gp > 0 ? fantasyTotal / gp : 0,
        };
      });
    } finally {
      this.statsLoading = false;
    }
  }

  async addMatch(): Promise<void> {
    try {
      await this.compService.createMatch(this.teamId, this.compId, {
        visitorTeamName: this.newMatch.is_local ? this.newMatch.rival_name : 'Nosotros',
        localTeamName: this.newMatch.is_local ? 'Nosotros' : this.newMatch.rival_name,
        date: this.newMatch.date ? new Date(this.newMatch.date).toISOString() : new Date().toISOString(),
        venue: this.newMatch.venue,
        isLocal: this.newMatch.is_local,
        state: MatchState.SCHEDULED,
      });
      this.newMatch = { rival_name: '', date: '', venue: '', is_local: true };
      this.matches = await this.compService.getMatches(this.compId);
      this.showAddMatchModal = false;
    } catch (e) {
      this.errorMsg = (e as Error).message;
    }
  }

  confirmDeleteMatch(matchId: string, event: Event): void {
    event.stopPropagation();
    this.matchToDeleteId = matchId;
    this.showDeleteMatchModal = true;
  }

  async deleteMatch(): Promise<void> {
    if (!this.matchToDeleteId) return;
    await this.compService.deleteMatch(this.matchToDeleteId);
    this.matches = await this.compService.getMatches(this.compId);
    this.showDeleteMatchModal = false;
  }

  async addRival(): Promise<void> {
    if (!this.newRivalName.trim()) return;
    await this.compService.addRival(this.compId, this.newRivalName.trim());
    this.newRivalName = '';
    this.rivals = await this.compService.getRivals(this.compId);
    this.showAddRivalModal = false;
  }

  confirmDeleteRival(rivalId: string): void {
    this.rivalToDeleteId = rivalId;
    this.showDeleteRivalModal = true;
  }

  async deleteRival(): Promise<void> {
    if (!this.rivalToDeleteId) return;
    await this.compService.deleteRival(this.rivalToDeleteId);
    this.rivals = await this.compService.getRivals(this.compId);
    this.showDeleteRivalModal = false;
  }

  goToMatch(matchId: string): void {
    this.router.navigate(['/partido-admin', matchId]);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  get rivalOptions(): Rival[] {
    return this.rivals;
  }
}
