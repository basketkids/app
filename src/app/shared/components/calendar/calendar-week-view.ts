import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarMatch } from '../../../core/services/calendar.service';
import { MatchCard } from './match-card';

export interface CalendarDay {
    dateKey: string;
    weekday: string;
    dayNum: number;
    isToday: boolean;
    inCurrentMonth: boolean;
    matches: CalendarMatch[];
}

@Component({
    selector: 'app-calendar-week-view',
    standalone: true,
    imports: [CommonModule, MatchCard],
    templateUrl: './calendar-week-view.html',
    styleUrls: ['./calendar-week-view.css']
})
export class CalendarWeekView {
    @Input({ required: true }) days!: CalendarDay[];
    @Output() matchClick = new EventEmitter<string>();
}
