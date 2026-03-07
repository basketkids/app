import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Avatar } from '../avatar/avatar';
import { AggregatedPlayerStat, MatchScore } from '../../../core/models/data/match.repository';

export interface PlayerStatRow extends AggregatedPlayerStat {
    ppg: number; apg: number; rpg: number; spg: number; bpg: number; fpg: number; vpg: number;
    fantasyTotal: number; fantasyPpg: number;
}

interface Category {
    key: keyof PlayerStatRow;
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    barColor: string;
}

@Component({
    selector: 'app-leaders-chart',
    imports: [CommonModule, Avatar],
    templateUrl: './leaders-chart.html',
})
export class LeadersChartComponent implements OnChanges {
    @Input() statRows: PlayerStatRow[] = [];
    @Input() matchScores: MatchScore[] = [];
    @Input() jerseyColor = '5199e4';
    @Input() title = 'Temporada';

    categories: Category[] = [
        { key: 'ppg', label: 'Puntos', icon: 'sports_basketball', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30', barColor: 'bg-orange-500' },
        { key: 'rpg', label: 'Rebotes', icon: 'back_hand', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30', barColor: 'bg-blue-500' },
        { key: 'apg', label: 'Asistencias', icon: 'handshake', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30', barColor: 'bg-green-500' },
        { key: 'spg', label: 'Robos', icon: 'bolt', color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', barColor: 'bg-yellow-500' },
        { key: 'bpg', label: 'Tapones', icon: 'pan_tool', color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30', barColor: 'bg-purple-500' },
    ];

    mvp: PlayerStatRow | null = null;

    // chart
    chartPoints: { x: number; y: number; score: number; date: string }[] = [];
    chartMax = 1;
    chartPath = '';
    chartArea = '';
    chartWidth = 400;
    chartHeight = 160;

    ngOnChanges(): void {
        this.computeMvp();
        this.computeChart();
    }

    private computeMvp(): void {
        if (!this.statRows.length) { this.mvp = null; return; }
        this.mvp = [...this.statRows].sort((a, b) => b.fantasyPpg - a.fantasyPpg)[0];
    }

    private computeChart(): void {
        if (!this.matchScores.length) { this.chartPoints = []; return; }
        this.chartMax = Math.max(...this.matchScores.map(m => Math.max(m.ourScore, m.rivalScore)), 10);
        const n = this.matchScores.length;
        this.chartPoints = this.matchScores.map((m, i) => ({
            x: n === 1 ? 50 : (i / (n - 1)) * this.chartWidth,
            y: this.chartHeight - (m.ourScore / this.chartMax) * this.chartHeight,
            score: m.ourScore,
            date: m.date,
        }));
        const pts = this.chartPoints;
        if (pts.length === 1) {
            this.chartPath = `M ${pts[0].x},${pts[0].y}`;
            this.chartArea = `M ${pts[0].x},${this.chartHeight} L ${pts[0].x},${pts[0].y} Z`;
        } else {
            this.chartPath = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
            this.chartArea = `M ${pts[0].x},${this.chartHeight} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${pts[pts.length - 1].x},${this.chartHeight} Z`;
        }
    }

    top3(key: keyof PlayerStatRow): PlayerStatRow[] {
        return [...this.statRows]
            .sort((a, b) => (b[key] as number) - (a[key] as number))
            .slice(0, 3);
    }

    barWidth(player: PlayerStatRow, key: keyof PlayerStatRow, top: PlayerStatRow[]): number {
        const max = top[0] ? (top[0][key] as number) : 1;
        return max > 0 ? ((player[key] as number) / max) * 100 : 0;
    }

    fmt(n: number): string { return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1); }

    rankColor(i: number): string {
        return ['bg-yellow-400 text-yellow-900', 'bg-slate-300 text-slate-800', 'bg-amber-700 text-amber-100'][i] ?? 'bg-slate-200 text-slate-700';
    }
}
