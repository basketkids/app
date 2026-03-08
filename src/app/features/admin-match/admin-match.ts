import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

import { MatchService } from '../../core/services/match.service';
import { Match, EventType } from '../../core/models/match.model';
import { Scoreboard } from '../../shared/components/scoreboard/scoreboard';
import { LiveEvents } from '../../shared/components/live-events/live-events';
import { StatisticsGrid } from '../../shared/components/statistics-grid/statistics-grid';
import { Avatar } from '../../shared/components/avatar/avatar';
import { LineupBoard } from '../../shared/components/lineup-board/lineup-board';
import { MatchProgression } from '../../shared/components/match-progression/match-progression';

import { MatchEngineService } from '../../core/services/match-engine.service';

@Component({
  selector: 'app-admin-match',
  templateUrl: './admin-match.html',
  styleUrls: ['./admin-match.css'],
  imports: [CommonModule, RouterLink, Scoreboard, LiveEvents, StatisticsGrid, Avatar, LineupBoard, MatchProgression]
})
export class AdminMatch implements OnInit, OnDestroy {
  matchId: string = '';
  match: Match | null = null;
  activeTab: 'pista' | 'en-vivo' | 'convocados' | 'cronica' | 'analisis' = 'convocados';
  private sub: Subscription = new Subscription();

  // Analysis data
  progression: any[] = [];
  partials: any[] = [];
  bestLineups: any[] = [];
  bestDefensiveLineups: any[] = [];

  // Track selected player on court
  selectedPlayerId: string | null = null;

  // State for substitutions modal
  showSubsModal: boolean = false;
  showConvocatoriaModal: boolean = false;
  showFalloModal: boolean = false;
  tempSelectedCourtIds: Set<string> = new Set();

  // Expose EventType and Object to template
  protected Object = Object;
  protected EventTypes = EventType;

  constructor(
    private route: ActivatedRoute,
    private matchService: MatchService,
    private matchEngine: MatchEngineService
  ) { }

  ngOnInit(): void {
    const matchId = this.route.snapshot.paramMap.get('id');

    this.sub.add(
      this.matchService.currentMatch$.subscribe(m => {
        this.match = m;
        if (m) {
          this.calculateAnalysis(m);
          // Auto-select first player on court if none selected
          if (m.playersOnCourt && !this.selectedPlayerId) {
            const players = Object.keys(m.playersOnCourt);
            if (players.length > 0) {
              this.selectedPlayerId = players[0];
            }
          }
        }
      })
    );

    if (matchId) {
      this.matchService.loadMatch(matchId);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.matchService.clearMatch();
  }

  // -- Getters for Template --
  get localFouls(): number {
    if (!this.match) return 0;
    return this.matchEngine.getTeamFouls(this.match.events, this.match.currentQuarter, true);
  }

  get visitorFouls(): number {
    if (!this.match) return 0;
    return this.matchEngine.getTeamFouls(this.match.events, this.match.currentQuarter, false);
  }

  private calculateAnalysis(m: Match) {
    if (!m.events) return;
    this.progression = this.matchEngine.getMatchProgression(m.events);
    this.partials = this.matchEngine.getQuarterPartials(m.events);

    const initialIds = Object.keys(m.playersOnCourt || {}).filter(id => m.playersOnCourt[id]);
    const performance = this.matchEngine.getLineupPerformance(m.events, initialIds);

    const combinedRoster = { ...m.plantilla, ...m.roster, ...m.convocados };

    const processLineup = (l: any) => {
      return {
        ...l,
        players: l.lineup.map((pid: string) => combinedRoster[pid] || { name: 'Player', id: pid, dorsal: '?' })
      };
    };

    this.bestLineups = performance.filter(l => l.diff > 0).slice(0, 3).map(processLineup);
    this.bestDefensiveLineups = [...performance].sort((a, b) => a.pointsAgainst - b.pointsAgainst).slice(0, 3).map(processLineup);
  }

  // -- Selection Logic --
  selectPlayer(playerId: string): void {
    this.selectedPlayerId = playerId;
  }

  // -- Action Dispatchers --
  addStat(type: EventType, value: number = 1): void {
    if (!this.selectedPlayerId) {
      alert('Por favor, selecciona un jugador de la pista primero.');
      return;
    }

    if (type === EventType.MISS) {
      this.showFalloModal = true;
      return;
    }

    this.matchService.addStat(this.selectedPlayerId, type, value);
  }

  confirmFallo(points: number): void {
    if (this.selectedPlayerId) {
      this.matchService.addStat(this.selectedPlayerId, EventType.MISS, points);
    }
    this.showFalloModal = false;
  }

  deleteEvent(id: string): void {
    this.matchService.deleteEvent(id);
  }

  addTeamPoints(points: number): void {
    this.addStat(EventType.POINTS, points);
  }

  addRivalPoints(points: number): void {
    this.matchService.addStat(-2, EventType.POINTS, points);
  }

  addRivalFoul(): void {
    this.matchService.addStat(-2, EventType.FOULS, 1);
  }

  addTimeout(isLocal: boolean): void {
    this.matchService.addTimeout(isLocal);
  }

  // -- Convocatoria Logic --
  openConvocatoriaModal(): void {
    this.tempSelectedCourtIds = new Set(Object.keys(this.match?.convocados || {}));
    this.showConvocatoriaModal = true;
  }

  closeConvocatoriaModal(): void {
    this.showConvocatoriaModal = false;
  }

  toggleConvocatoriaSub(playerId: string): void {
    if (this.tempSelectedCourtIds.has(playerId)) {
      this.tempSelectedCourtIds.delete(playerId);
    } else {
      this.tempSelectedCourtIds.add(playerId);
    }
  }

  saveConvocatoria(): void {
    this.matchService.setConvocados(Array.from(this.tempSelectedCourtIds));
    this.showConvocatoriaModal = false;
  }

  // -- Substitutions Logic --
  openSubsModal(): void {
    this.tempSelectedCourtIds = new Set(Object.keys(this.match?.playersOnCourt || {}));
    this.showSubsModal = true;
  }

  closeSubsModal(): void {
    this.showSubsModal = false;
  }

  togglePlayerSub(playerId: string): void {
    if (this.tempSelectedCourtIds.has(playerId)) {
      this.tempSelectedCourtIds.delete(playerId);
    } else {
      if (this.tempSelectedCourtIds.size >= 5) {
        alert('No puedes tener más de 5 jugadores en pista.');
        return;
      }
      this.tempSelectedCourtIds.add(playerId);
    }
  }

  saveSubstitutions(): void {
    this.matchService.setPlayersOnCourt(Array.from(this.tempSelectedCourtIds));

    // Update selected player if they were subbed out
    if (this.selectedPlayerId && !this.tempSelectedCourtIds.has(this.selectedPlayerId)) {
      const players = Array.from(this.tempSelectedCourtIds);
      this.selectedPlayerId = players.length > 0 ? players[0] : null;
    }

    this.showSubsModal = false;
  }

  // -- Timer Controls --
  toggleTimer(): void {
    this.matchService.toggleTimer();
  }

  advanceQuarter(): void {
    if (confirm('¿Terminar cuarto actual y pasar al siguiente?')) {
      this.matchService.advanceQuarter();
    }
  }

  endMatch(): void {
    if (confirm('¿Finalizar el partido definitivamente?')) {
      this.matchService.endMatch();
    }
  }

  // -- General functionality --
  alertFeature(featureName: string): void {
    alert(`[WIP] La funcionalidad "${featureName}" está en desarrollo.`);
  }
}
