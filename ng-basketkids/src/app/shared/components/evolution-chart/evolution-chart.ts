import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchScore } from '../../../core/models/data/match.repository';

@Component({
    selector: 'app-evolution-chart',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './evolution-chart.html'
})
export class EvolutionChartComponent implements OnChanges {
    @Input() matchScores: MatchScore[] = [];
    @Input() title = 'Evolución de Anotación';
    @Input() type: 'score' | 'diff' = 'score';
    @Input() color = '#f97316';
    @Input() rivalColor = '#171717';

    chartWidth = 400;
    chartHeight = 200;
    chartMax = 100;

    ourArea = '';
    ourPath = '';
    rivalPath = '';

    chartPoints: any[] = [];
    gradId = `evo-grad-${Math.random().toString(36).substr(2, 9)}`;
    safeColor = '#5199e4';

    ngOnChanges(): void {
        this.safeColor = this.color ? (this.color.startsWith('#') ? this.color.replace('##', '#') : '#' + this.color) : '#5199e4';
        this.computeChart();
    }

    private computeChart(): void {
        if (!this.matchScores || this.matchScores.length === 0) {
            this.chartPoints = [];
            return;
        }

        if (this.type === 'diff') {
            let maxDiff = 0;
            this.matchScores.forEach(s => {
                const d = Math.abs(s.ourScore - s.rivalScore);
                if (d > maxDiff) maxDiff = d;
            });
            this.chartMax = Math.max(Math.ceil(maxDiff / 10) * 10, 10);

            const w = this.chartWidth;
            const h = this.chartHeight;
            const len = Math.max(this.matchScores.length, 2);
            let step = w / (len - 1);
            if (this.matchScores.length === 1) step = w / 2;

            this.chartPoints = this.matchScores.map((s, i) => {
                const x = this.matchScores.length === 1 ? step : i * step;
                const diff = s.ourScore - s.rivalScore;
                const yPoint = h / 2 - (diff / this.chartMax) * (h / 2);

                const barHeight = Math.abs(yPoint - h / 2);
                const barY = diff > 0 ? yPoint : h / 2;

                const dateStr = s.date && s.date !== '?' ? s.date : `P${i + 1}`;
                return { x, yPoint, barY, barHeight, diff, dateStr, ...s };
            });
            return;
        }

        let max = 0;
        this.matchScores.forEach(s => {
            if (s.ourScore > max) max = s.ourScore;
            if (s.rivalScore > max) max = s.rivalScore;
        });
        this.chartMax = Math.max(Math.ceil(max / 10) * 10 + 10, 50);

        const w = this.chartWidth;
        const h = this.chartHeight;
        const len = Math.max(this.matchScores.length, 2);
        let step = w / (len - 1);
        if (this.matchScores.length === 1) step = w / 2;

        this.chartPoints = this.matchScores.map((s, i) => {
            const x = this.matchScores.length === 1 ? step : i * step;
            const yOur = h - (s.ourScore / this.chartMax) * h;
            const yRival = h - (s.rivalScore / this.chartMax) * h;
            // The date string is already shortened in the repository (e.g., '15 oct')
            const dateStr = s.date && s.date !== '?' ? s.date : `P${i + 1}`;
            return { x, yOur, yRival, dateStr, ...s };
        });

        if (this.chartPoints.length > 0) {
            this.ourPath = 'M ' + this.chartPoints.map(p => `${p.x},${p.yOur}`).join(' L ');
            this.rivalPath = 'M ' + this.chartPoints.map(p => `${p.x},${p.yRival}`).join(' L ');

            this.ourArea = this.ourPath + ` L ${w},${h} L 0,${h} Z`;
        } else {
            this.ourPath = '';
            this.rivalPath = '';
            this.ourArea = '';
        }
    }
}
