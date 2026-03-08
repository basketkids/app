import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

import { PlayerRosterData } from '../../core/models/player.model';
import { MatchService } from '../../core/services/match.service';
import { MatchEngineService } from '../../core/services/match-engine.service';
import { TeamService } from '../../core/services/team.service';
import { ProfileRepository, PublicitySettings } from '../../core/models/data/profile.repository';
import { LiveEvents } from '../../shared/components/live-events/live-events';
import { Scoreboard } from '../../shared/components/scoreboard/scoreboard';
import { StatisticsGrid } from '../../shared/components/statistics-grid/statistics-grid';
import { Avatar } from '../../shared/components/avatar/avatar';
import { LineupBoard } from '../../shared/components/lineup-board/lineup-board';
import { MatchProgression } from '../../shared/components/match-progression/match-progression';
import { Match, MatchEvent } from '../../core/models/match.model';

export interface LeaderPerformer {
  playerId: string;
  name: string;
  dorsal: string | number;
  value: number;
  category: string;
  icon: string;
}

@Component({
  selector: 'app-public-match',
  templateUrl: './public-match.html',
  styleUrls: ['./public-match.css'],
  imports: [CommonModule, LiveEvents, Scoreboard, StatisticsGrid, Avatar, LineupBoard, MatchProgression]
})
export class PublicMatch implements OnInit, OnDestroy {
  match: Match | null = null;
  activeTab: 'en-vivo' | 'estadisticas' | 'cronica' | 'resumen' | 'analisis' = 'estadisticas';
  mvp: LeaderPerformer | null = null;
  leaders: LeaderPerformer[] = [];

  // Analysis data
  progression: any[] = [];
  partials: any[] = [];
  bestLineups: any[] = [];
  bestDefensiveLineups: any[] = [];

  private sub: Subscription = new Subscription();

  publicitySettings: PublicitySettings = {
    stats: true,
    events: true,
    chronicle: false,
    fantasy: false,
    leaders: false,
    mvp: false
  };

  constructor(
    private route: ActivatedRoute,
    private matchService: MatchService,
    private matchEngine: MatchEngineService,
    private teamService: TeamService,
    private profileRepo: ProfileRepository
  ) { }

  ngOnInit(): void {
    // 1. Get ID from URL
    const matchId = this.route.snapshot.paramMap.get('id');

    // 2. Subscribe to the Match State from the Service
    this.sub.add(
      this.matchService.currentMatch$.subscribe(m => {
        this.match = m;
        if (m) {
          this.calculateMvpAndLeaders(m);
          this.calculateAnalysis(m);
          if (m.teamId) {
            this.loadPublicitySettings(m.teamId);
          }
        }
      })
    );

    // 3. Trigger initial load
    if (matchId) {
      this.matchService.loadMatch(matchId);
    }
  }

  async loadPublicitySettings(teamId: string) {
    try {
      const team = await this.teamService.getTeam(teamId);
      if (team?.owner_id) {
        const profile = await this.profileRepo.getProfile(team.owner_id);
        if (profile?.publicity_settings) {
          this.publicitySettings = { ...this.publicitySettings, ...profile.publicity_settings };
          // If current tab is not allowed, switch to first allowed
          if (this.activeTab === 'en-vivo' && !this.publicitySettings.events) {
            if (this.publicitySettings.mvp || this.publicitySettings.leaders) this.activeTab = 'resumen';
            else if (this.publicitySettings.stats) this.activeTab = 'estadisticas';
            else if (this.publicitySettings.chronicle) this.activeTab = 'cronica';
          }
        }
      }
    } catch (e) {
      console.error('Error loading publicity settings:', e);
    }
  }

  private calculateMvpAndLeaders(m: Match) {
    if (!m.stats || !m.roster) return;

    const statsArray = Object.entries(m.stats).map(([pid, s]) => ({ pid, s }));
    if (statsArray.length === 0) return;

    // MVP (by Valoracion)
    const sortedByVal = [...statsArray].sort((a, b) => (b.s.valoracion || 0) - (a.s.valoracion || 0));
    const topVal = sortedByVal[0];
    if (topVal && (topVal.s.valoracion || 0) > 0) {
      const p = m.roster[topVal.pid] || m.plantilla[topVal.pid];
      if (p) {
        this.mvp = {
          playerId: topVal.pid,
          name: p.name,
          dorsal: p.dorsal,
          value: topVal.s.valoracion || 0,
          category: 'MVP',
          icon: 'star'
        };
      }
    }

    // Leaders categories
    const categories: { key: keyof typeof topVal.s; label: string; icon: string }[] = [
      { key: 'points', label: 'Puntos', icon: 'sports_basketball' },
      { key: 'rebounds', label: 'Rebotes', icon: 'back_hand' },
      { key: 'assists', label: 'Asistencias', icon: 'handshake' },
      { key: 'steals', label: 'Robos', icon: 'bolt' },
      { key: 'blocks', label: 'Tapones', icon: 'pan_tool' }
    ];

    this.leaders = categories.map(cat => {
      const top = [...statsArray].sort((a, b) => ((b.s[cat.key] as number) || 0) - ((a.s[cat.key] as number) || 0))[0];
      if (top && ((top.s[cat.key] as number) || 0) > 0) {
        const p = m.roster[top.pid] || m.plantilla[top.pid];
        if (p) {
          return {
            playerId: top.pid,
            name: p.name,
            dorsal: p.dorsal,
            value: (top.s[cat.key] as number) || 0,
            category: cat.label,
            icon: cat.icon
          };
        }
      }
      return null;
    }).filter(l => l !== null) as LeaderPerformer[];
  }

  get combinedRoster(): Record<string, PlayerRosterData> {
    if (!this.match) return {};
    return { ...this.match.plantilla, ...this.match.roster };
  }

  private calculateAnalysis(m: Match) {
    if (!m.events) return;
    this.progression = this.matchEngine.getMatchProgression(m.events);
    this.partials = this.matchEngine.getQuarterPartials(m.events);

    // Initial lineup logic: take the 5 players in roster who are onCourt OR first 5 summoned if none on court
    const initialIds = Object.keys(m.playersOnCourt || {}).filter(id => m.playersOnCourt[id]);
    const performance = this.matchEngine.getLineupPerformance(m.events, initialIds);

    // Process lineup performance into player data
    const processLineup = (l: any) => {
      return {
        ...l,
        players: l.lineup.map((pid: string) => this.combinedRoster[pid] || { name: 'Player', id: pid, dorsal: '?' })
      };
    };

    this.bestLineups = performance.filter(l => l.diff > 0).slice(0, 3).map(processLineup);
    this.bestDefensiveLineups = [...performance].sort((a, b) => a.pointsAgainst - b.pointsAgainst).slice(0, 3).map(processLineup);
  }

  get localFouls(): number {
    if (!this.match) return 0;
    return this.matchEngine.getTeamFouls(this.match.events, this.match.currentQuarter, this.match.isLocal);
  }

  get visitorFouls(): number {
    if (!this.match) return 0;
    return this.matchEngine.getTeamFouls(this.match.events, this.match.currentQuarter, !this.match.isLocal);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
