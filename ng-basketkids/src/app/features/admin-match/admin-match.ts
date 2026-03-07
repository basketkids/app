import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

import { MatchService } from '../../core/services/match.service';
import { Match, EventType } from '../../core/models/match.model';
import { Scoreboard } from '../../shared/components/scoreboard/scoreboard';
import { LiveEvents } from '../../shared/components/live-events/live-events';
import { StatisticsGrid } from '../../shared/components/statistics-grid/statistics-grid';

@Component({
  selector: 'app-admin-match',
  templateUrl: './admin-match.html',
  styleUrls: ['./admin-match.css'],
  imports: [CommonModule, RouterModule, Scoreboard, LiveEvents, StatisticsGrid]
})
export class AdminMatch implements OnInit, OnDestroy {
  match: Match | null = null;
  activeTab: 'convocados' | 'pista' | 'en-vivo' | 'cronica' = 'convocados';
  private sub: Subscription = new Subscription();

  // Track selected player on court
  selectedPlayerId: string | null = null;

  // State for substitutions modal
  showSubsModal: boolean = false;
  showConvocatoriaModal: boolean = false;
  tempSelectedCourtIds: Set<string> = new Set();

  // Expose EventType and Object to template
  EventTypes = EventType;
  Object = Object;

  constructor(
    private route: ActivatedRoute,
    private matchService: MatchService
  ) { }

  ngOnInit(): void {
    const matchId = this.route.snapshot.paramMap.get('id');

    this.sub.add(
      this.matchService.currentMatch$.subscribe(m => {
        this.match = m;
        // Auto-select first player on court if none selected
        if (m && m.playersOnCourt && !this.selectedPlayerId) {
          const players = Object.keys(m.playersOnCourt);
          if (players.length > 0) {
            this.selectedPlayerId = players[0];
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
    this.matchService.addStat(this.selectedPlayerId, type, value);
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
