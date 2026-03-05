import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CalendarService, CalendarMatch } from '../../core/services/calendar.service';
import { AuthService } from '../../core/services/auth.service';
import { CalendarWeekView, CalendarDay } from '../../shared/components/calendar/calendar-week-view';
import { CalendarMonthView } from '../../shared/components/calendar/calendar-month-view';

type ViewMode = 'week' | 'month';

@Component({
    selector: 'app-calendario',
    imports: [CommonModule, RouterModule, CalendarWeekView, CalendarMonthView],
    templateUrl: './calendario.html',
    styleUrls: ['./calendario.css']
})
export class Calendario implements OnInit {
    allMatches: CalendarMatch[] = [];
    calDays: CalendarDay[] = [];
    viewMode: ViewMode = 'week';
    pivotOffset = 0;          // weeks shifted from today (week view)
    currentMonth = new Date();// month being displayed (month view)

    loading = true;
    errorMsg = '';
    totalThisPeriod = 0;

    constructor(
        private calService: CalendarService,
        private auth: AuthService,
        private router: Router
    ) {
        this.currentMonth = new Date();
        this.currentMonth.setDate(1);
    }

    async ngOnInit(): Promise<void> {
        const userId = this.auth.currentSession?.user?.id;
        if (!userId) { this.loading = false; return; }
        try {
            this.allMatches = await this.calService.getAllUserMatches(userId);
            console.log('[Calendario] total matches loaded:', this.allMatches.length);
            this.allMatches.forEach(m =>
                console.log(`[Match] id=${m.id} state="${m.state}" score=${m.team_score}-${m.rival_score}`)
            );
            this.buildView();
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loading = false;
        }
    }

    buildView(): void {
        const byDay = this.calService.groupByDay(this.allMatches);

        if (this.viewMode === 'week') {
            const start = this.calService.getTodayStart();
            start.setDate(start.getDate() + this.pivotOffset);
            const keys = this.calService.getDayRange(start, 7);
            this.calDays = keys.map(k => ({
                ...this.calService.formatDayHeader(k),
                dateKey: k,
                inCurrentMonth: true,
                matches: byDay.get(k) ?? []
            }));
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
        }

        this.totalThisPeriod = this.calDays.reduce((s, d) => s + d.matches.length, 0);
    }

    prevPeriod(): void {
        if (this.viewMode === 'week') { this.pivotOffset -= 7; }
        else { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.currentMonth = new Date(this.currentMonth); }
        this.buildView();
    }

    nextPeriod(): void {
        if (this.viewMode === 'week') { this.pivotOffset += 7; }
        else { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.currentMonth = new Date(this.currentMonth); }
        this.buildView();
    }

    goToday(): void {
        this.pivotOffset = 0;
        this.currentMonth = new Date(); this.currentMonth.setDate(1);
        this.buildView();
    }

    setView(mode: ViewMode): void {
        this.viewMode = mode;
        this.buildView();
    }

    goToMatch(matchId: string): void {
        this.router.navigate(['/partido-admin', matchId]);
    }

    get periodLabel(): string {
        if (this.viewMode === 'week') {
            const start = this.calService.getTodayStart();
            start.setDate(start.getDate() + this.pivotOffset);
            const end = new Date(start); end.setDate(end.getDate() + 6);
            const s = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const e = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${s} – ${e}`;
        }
        return this.calService.getMonthLabel(this.currentMonth);
    }
}
