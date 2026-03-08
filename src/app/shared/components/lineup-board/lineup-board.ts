import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Avatar } from '../avatar/avatar';
import { PlayerRosterData } from '../../../core/models/player.model';

@Component({
    selector: 'app-lineup-board',
    standalone: true,
    imports: [CommonModule, Avatar],
    templateUrl: './lineup-board.html',
    styleUrls: ['./lineup-board.css']
})
export class LineupBoard {
    @Input() players: PlayerRosterData[] = [];
    @Input() stats: { pointsFor: number, pointsAgainst: number, diff: number } | null = null;
    @Input() title: string = 'Quinteto';
    @Input() jerseyColor: string = '5199e4';

    get positions() {
        return [
            { top: '75%', left: '50%' },  // Base
            { top: '55%', left: '15%' },  // Alero Izq
            { top: '55%', left: '85%' },  // Alero Der
            { top: '25%', left: '30%' },  // Pivot Izq
            { top: '25%', left: '70%' }   // Pivot Der
        ];
    }
}
