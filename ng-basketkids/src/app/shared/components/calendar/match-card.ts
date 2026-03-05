import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarMatch } from '../../../core/services/calendar.service';

type MatchState = string;

@Component({
    selector: 'app-match-card',
    imports: [CommonModule],
    templateUrl: './match-card.html',
    styleUrls: ['./match-card.css']
})
export class MatchCard {
    @Input({ required: true }) match!: CalendarMatch;
    @Output() matchClick = new EventEmitter<string>();

    get normalizedState(): MatchState {
        const s = (this.match.state ?? '').toLowerCase().replace(' ', '_');
        if (s === 'terminado' || s === 'finalizado') return 'finalizado';
        return s;
    }

    get isFinished(): boolean {
        return this.normalizedState === 'finalizado';
    }

    /** Show score if we have a numeric value, regardless of the state label */
    get hasScore(): boolean {
        return this.match.team_score != null && this.match.rival_score != null;
    }

    get localName(): string {
        return this.match.is_local ? this.match.team_name : this.match.rival_name;
    }

    get visitorName(): string {
        return this.match.is_local ? this.match.rival_name : this.match.team_name;
    }

    get localScore(): number {
        return this.match.is_local ? this.match.team_score : this.match.rival_score;
    }

    get visitorScore(): number {
        return this.match.is_local ? this.match.rival_score : this.match.team_score;
    }

    get mapsUrl(): string {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.match.location ?? '')}`;
    }

    formatTime(dateStr: string): string {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
}
