import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarMatch } from '../../../core/services/calendar.service';
import { CalendarDay } from './calendar-week-view';

const WEEKDAY_HEADERS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

@Component({
    selector: 'app-calendar-month-view',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar-month-view.html',
    styleUrls: ['./calendar-month-view.css']
})
export class CalendarMonthView {
    @Input({ required: true }) days!: CalendarDay[];
    @Output() matchClick = new EventEmitter<string>();
    readonly headers = WEEKDAY_HEADERS;

    matchTitle(m: CalendarMatch): string {
        return `${m.team_name} vs ${m.rival_name}${m.state === 'finalizado' ? ' · ' + m.team_score + '-' + m.rival_score : ''}`;
    }

    isFinished(m: CalendarMatch): boolean {
        const s = m.state?.toLowerCase();
        return s === 'finalizado' || s === 'finished';
    }

    isWin(m: CalendarMatch): boolean {
        return this.isFinished(m) && m.team_score > m.rival_score;
    }

    isLoss(m: CalendarMatch): boolean {
        return this.isFinished(m) && m.team_score < m.rival_score;
    }
}
