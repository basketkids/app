import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchEvent, EventType } from '../../../core/models/event.model';
import { PlayerRosterData } from '../../../core/models/player.model';
import { Avatar } from '../avatar/avatar';

interface DisplayEvent {
  event: MatchEvent;
  playerName: string;
  badgeClass: string;
  isRival: boolean;
}

@Component({
  selector: 'app-live-events',
  standalone: true,
  templateUrl: './live-events.html',
  styleUrls: ['./live-events.css'],
  imports: [CommonModule, Avatar]
})
export class LiveEvents implements OnChanges {
  @Input() events: Record<string, MatchEvent> = {};
  @Input() roster: Record<string, PlayerRosterData> = {};
  @Input() adminMode: boolean = false;
  @Output() onDelete = new EventEmitter<string>();

  protected EventTypes = EventType;
  displayEvents: DisplayEvent[] = [];
  activeQuarter: number = 0; // 0 = Todos, 1-4 = Cuartos
  quarters = [0, 1, 2, 3, 4];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['events'] || changes['roster']) {
      this.buildDisplayList();
    }
  }

  setQuarter(q: number): void {
    this.activeQuarter = q;
    this.buildDisplayList();
  }

  getEventIcon(type: string): string {
    switch (type) {
      case 'puntos': return 'sports_basketball';
      case 'faltas': return 'gavel';
      case 'cambio': return 'sync_alt';
      case 'asistencias': return 'handshake';
      case 'rebotes': return 'front_hand';
      case 'robos': return 'lock';
      case 'tapones': return 'back_hand';
      case 'fallo': return 'error';
      case 'tiempo muerto': return 'timer';
      default: return 'info';
    }
  }

  getPlayerAvatar(playerId: string | number): Record<string, any> | null {
    if (playerId === -2) return null;
    return this.roster[playerId as string]?.avatarConfig || null;
  }

  deleteEvent(id: string): void {
    if (confirm('¿Estás seguro de que quieres borrar este evento? El marcador y las estadísticas se recalcularán.')) {
      this.onDelete.emit(id);
    }
  }

  private buildDisplayList(): void {
    // Filter and Sort events by time (newest first)
    let eventsArr = Object.values(this.events || {});

    if (this.activeQuarter !== 0) {
      eventsArr = eventsArr.filter(ev => ev.quarter === this.activeQuarter);
    }

    const sorted = eventsArr.sort((a, b) => {
      // Primary: Quarter (higher is newer)
      if (b.quarter !== a.quarter) {
        return b.quarter - a.quarter;
      }
      // Secondary: Seconds Remaining (lower is newer)
      return a.secondsRemaining - b.secondsRemaining;
    });

    this.displayEvents = sorted.map(ev => {
      let playerName = 'Rival';
      let badgeClass = 'bg-slate-500';

      if (ev.playerId !== -2 && (this.roster || {})[ev.playerId]) {
        playerName = (this.roster || {})[ev.playerId].name;
        badgeClass = 'bg-primary';
      } else if (ev.playerId !== -2 && ev.playerName) {
        playerName = ev.playerName;
        if (ev.playerDorsal) playerName += ` (#${ev.playerDorsal})`;
        badgeClass = 'bg-primary';
      }

      const isRival = ev.playerId === -2 || ev.playerId === -1; // -1 for local timeout? no, keep it simple
      // Actually, let's use the logic from addStat/addTimeout: local timeout is -1, rival -2
      // But addStat uses playerId -2 for rival. Let's assume -2 = rival.

      const realIsRival = ev.playerId === -2;

      if (ev.type === 'faltas') badgeClass = realIsRival ? 'bg-red-600' : 'bg-red-500';
      if (ev.type === 'puntos') badgeClass = realIsRival ? 'bg-red-600' : 'bg-green-500';
      if (ev.type === 'fallo') badgeClass = 'bg-orange-500';
      if (ev.type === 'tiempo muerto') badgeClass = realIsRival ? 'bg-red-600' : 'bg-primary';

      return { event: ev, playerName, badgeClass, isRival: realIsRival };
    });
  }
}
