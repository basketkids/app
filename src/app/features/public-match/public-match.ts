import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

import { MatchService } from '../../core/services/match.service';
import { LiveEvents } from '../../shared/components/live-events/live-events';
import { Scoreboard } from '../../shared/components/scoreboard/scoreboard';
import { StatisticsGrid } from '../../shared/components/statistics-grid/statistics-grid';
import { Match } from '../../core/models/match.model';

@Component({
  selector: 'app-public-match',
  templateUrl: './public-match.html',
  styleUrls: ['./public-match.css'],
  imports: [CommonModule, LiveEvents, Scoreboard, StatisticsGrid]
})
export class PublicMatch implements OnInit, OnDestroy {
  match: Match | null = null;
  activeTab: 'en-vivo' | 'estadisticas' = 'en-vivo';
  private sub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private matchService: MatchService
  ) { }

  ngOnInit(): void {
    // 1. Get ID from URL
    const matchId = this.route.snapshot.paramMap.get('id');

    // 2. Subscribe to the Match State from the Service
    this.sub.add(
      this.matchService.currentMatch$.subscribe(m => this.match = m)
    );

    // 3. Trigger initial load
    if (matchId) {
      this.matchService.loadMatch(matchId);
      // In a real scenario we'd also subscribe to Supabase realtime here or in the Service
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
