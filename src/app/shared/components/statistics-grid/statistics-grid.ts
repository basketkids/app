import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStatistic, PlayerRosterData } from '../../../core/models/player.model';

interface StatsRow {
  player: PlayerRosterData;
  stats: PlayerStatistic;
}

@Component({
  selector: 'app-statistics-grid',
  standalone: true,
  templateUrl: './statistics-grid.html',
  styleUrls: ['./statistics-grid.css'],
  imports: [CommonModule]
})
export class StatisticsGrid implements OnChanges {
  @Input() stats: Record<string, PlayerStatistic> = {};
  @Input() roster: Record<string, PlayerRosterData> = {};

  rows: StatsRow[] = [];

  sortColumn: string = 'valoracion';
  sortAsc: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stats'] || changes['roster']) {
      this.rebuildRows();
    }
  }

  private rebuildRows(): void {
    if (!this.roster) { this.rows = []; return; }
    let baseRows = Object.keys(this.roster || {}).map(playerId => {
      const player = this.roster[playerId];
      const playerStats = (this.stats ?? {})[playerId] || this.getEmptyStats();
      return { player, stats: playerStats };
    });

    this.rows = this.sortRows(baseRows);
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = false; // By default sort descending for stats
    }
    this.rows = this.sortRows([...this.rows]);
  }

  private sortRows(rows: StatsRow[]): StatsRow[] {
    return rows.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (this.sortColumn === 'name' || this.sortColumn === 'dorsal') {
        valA = a.player[this.sortColumn as keyof PlayerRosterData];
        valB = b.player[this.sortColumn as keyof PlayerRosterData];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
      } else {
        valA = a.stats[this.sortColumn as keyof PlayerStatistic] || 0;
        valB = b.stats[this.sortColumn as keyof PlayerStatistic] || 0;
      }

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  private getEmptyStats(): PlayerStatistic {
    return { points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, valoracion: 0, plusMinus: 0 };
  }
}
