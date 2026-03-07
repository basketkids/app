import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchEvent } from '../../../core/models/event.model';
import { PlayerRosterData } from '../../../core/models/player.model';

interface DisplayEvent {
  event: MatchEvent;
  playerName: string;
  badgeClass: string;
}

@Component({
  selector: 'app-live-events',
  standalone: true,
  templateUrl: './live-events.html',
  styleUrls: ['./live-events.css'],
  imports: [CommonModule]
})
export class LiveEvents implements OnChanges {
  @Input() events: Record<string, MatchEvent> = {};
  @Input() roster: Record<string, PlayerRosterData> = {};

  displayEvents: DisplayEvent[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['events'] || changes['roster']) {
      this.buildDisplayList();
    }
  }

  private buildDisplayList(): void {
    // Sort events by time (newest first)
    const sorted = Object.values(this.events || {}).sort((a, b) => b.secondsRemaining - a.secondsRemaining);

    this.displayEvents = sorted.map(ev => {
      let playerName = 'Rival';
      let badgeClass = 'bg-secondary';

      if (ev.playerId !== -2 && (this.roster || {})[ev.playerId]) {
        playerName = (this.roster || {})[ev.playerId].name;
        badgeClass = 'bg-primary';
      } else if (ev.playerId !== -2 && ev.playerName) {
        playerName = ev.playerName;
        if (ev.playerDorsal) playerName += ` (#${ev.playerDorsal})`;
        badgeClass = 'bg-primary';
      }

      if (ev.type === 'faltas') badgeClass = 'bg-danger';
      if (ev.type === 'puntos') badgeClass = 'bg-success';

      return { event: ev, playerName, badgeClass };
    });
  }
}
