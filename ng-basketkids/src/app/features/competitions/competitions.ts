import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CompetitionService, Competition, Match, Rival, MatchState } from '../../core/services/competition.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-competitions',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './competitions.html',
  styleUrls: ['./competitions.css']
})
export class Competitions implements OnInit {
  competition: Competition | null = null;
  matches: Match[] = [];
  rivals: Rival[] = [];
  activeTab: 'partidos' | 'rivales' = 'partidos';

  // New match form
  newMatch = { rival_name: '', date: '', venue: '', is_local: true };
  // New rival form
  newRivalName = '';

  errorMsg = '';
  loading = true;

  private compId = '';
  private teamId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private compService: CompetitionService,
    public auth: AuthService
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
    } catch (e) {
      this.errorMsg = (e as Error).message;
    } finally {
      this.loading = false;
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
      this.closeModal('addPartidoModal');
    } catch (e) {
      this.errorMsg = (e as Error).message;
    }
  }

  async deleteMatch(matchId: string): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres borrar este partido?')) return;
    await this.compService.deleteMatch(matchId);
    this.matches = await this.compService.getMatches(this.compId);
  }

  async addRival(): Promise<void> {
    if (!this.newRivalName.trim()) return;
    await this.compService.addRival(this.compId, this.newRivalName.trim());
    this.newRivalName = '';
    this.rivals = await this.compService.getRivals(this.compId);
    this.closeModal('addRivalModal');
  }

  async deleteRival(rivalId: string): Promise<void> {
    if (!confirm('¿Borrar este rival?')) return;
    await this.compService.deleteRival(rivalId);
    this.rivals = await this.compService.getRivals(this.compId);
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

  private closeModal(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      const modal = (window as Window & { bootstrap?: { Modal: { getInstance: (el: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Modal.getInstance(el);
      modal?.hide();
    }
  }
}
