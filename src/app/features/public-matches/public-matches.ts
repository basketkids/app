import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CalendarService, CalendarMatch } from '../../core/services/calendar.service';
import { MatchState } from '../../core/models/match.model';

import { CalendarDay, CalendarWeekView } from '../../shared/components/calendar/calendar-week-view';
import { CalendarMonthView } from '../../shared/components/calendar/calendar-month-view';

@Component({
    selector: 'app-public-matches',
    imports: [CommonModule, RouterModule, CalendarWeekView, CalendarMonthView],
    templateUrl: './public-matches.html',
    styleUrls: ['./public-matches.css']
})
export class PublicMatches implements OnInit {
    allMatches: CalendarMatch[] = [];
    calDays: CalendarDay[] = [];
    loading = true;
    errorMsg = '';
    MatchState = MatchState;

    viewMode: 'week' | 'month' = 'week';
    periodLabel = '';
    totalThisPeriod = 0;
    pivotOffset = 0; // weeks shifted from today (week view)
    currentMonth = new Date(); // month being displayed (month view)

    constructor(private calService: CalendarService, private router: Router) { }

    async ngOnInit(): Promise<void> {
        this.currentMonth = new Date();
        this.currentMonth.setDate(1);
        await this.loadMatches();
    }

    async loadMatches(): Promise<void> {
        this.loading = true;
        try {
            this.allMatches = await this.calService.getPublicMatches();
            this.buildView();
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loading = false;
        }
    }

    setView(mode: 'week' | 'month'): void {
        this.viewMode = mode;
        this.pivotOffset = 0;
        this.currentMonth = new Date();
        this.currentMonth.setDate(1);
        this.buildView();
    }

    nextPeriod(): void {
        if (this.viewMode === 'week') {
            this.pivotOffset++;
        } else {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        }
        this.buildView();
    }

    prevPeriod(): void {
        if (this.viewMode === 'week') {
            this.pivotOffset--;
        } else {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        }
        this.buildView();
    }

    goToday(): void {
        this.pivotOffset = 0;
        this.currentMonth = new Date();
        this.currentMonth.setDate(1);
        this.buildView();
    }

    buildView(): void {
        const byDay = this.calService.groupByDay(this.allMatches);

        if (this.viewMode === 'week') {
            const start = this.calService.getTodayStart();
            start.setDate(start.getDate() + (this.pivotOffset * 7));

            const daysToLoad = 7;
            const range = this.calService.getDayRange(start, daysToLoad);
            this.calDays = range.map(k => ({
                ...this.calService.formatDayHeader(k),
                dateKey: k,
                inCurrentMonth: true,
                matches: byDay.get(k) || []
            }));

            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            this.periodLabel = `${start.getDate()} ${this.calService.getMonthLabel(start).split(' ')[0]} - ${end.getDate()} ${this.calService.getMonthLabel(end)}`;
        } else {
            const monthKeys = this.calService.getMonthDays(this.currentMonth);
            const firstDay = new Date(monthKeys[0] + 'T00:00:00');
            const startOffset = (firstDay.getDay() + 6) % 7;
            const paddedStart = new Date(firstDay);
            paddedStart.setDate(paddedStart.getDate() - startOffset);
            const totalCells = Math.ceil((monthKeys.length + startOffset) / 7) * 7;
            const allKeys = this.calService.getDayRange(paddedStart, totalCells);

            this.calDays = allKeys.map(k => ({
                ...this.calService.formatDayHeader(k),
                dateKey: k,
                inCurrentMonth: k >= monthKeys[0] && k <= monthKeys[monthKeys.length - 1],
                matches: byDay.get(k) ?? []
            }));
            this.periodLabel = this.calService.getMonthLabel(this.currentMonth);
        }

        this.totalThisPeriod = this.calDays.reduce((acc, d) => acc + d.matches.length, 0);
    }

    goToMatch(matchId: string): void {
        this.router.navigate(['/partido', matchId]);
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('es-ES', {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    }
}
