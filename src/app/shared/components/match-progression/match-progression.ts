import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-match-progression',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './match-progression.html',
    styleUrls: ['./match-progression.css']
})
export class MatchProgression implements OnChanges {
    @Input() progression: { time: number, local: number, visitor: number }[] = [];
    @Input() partials: { quarter: number, local: number, visitor: number }[] = [];
    @Input() localColor: string = '#f97316';
    @Input() visitorColor: string = '#475569';

    chartWidth = 800;
    chartHeight = 300;
    maxScore = 100;
    maxTime = 2400; // 40 minutes

    localPath = '';
    visitorPath = '';
    localArea = '';
    points: any[] = [];

    ngOnChanges(): void {
        this.computeChart();
    }

    private computeChart(): void {
        if (!this.progression || this.progression.length === 0) return;

        // Find max score and time
        let maxS = 20;
        this.progression.forEach(p => {
            if (p.local > maxS) maxS = p.local;
            if (p.visitor > maxS) maxS = p.visitor;
        });
        this.maxScore = Math.ceil(maxS / 10) * 10;

        const lastP = this.progression[this.progression.length - 1];
        this.maxTime = Math.max(lastP.time, 600); // At least one q

        const w = this.chartWidth;
        const h = this.chartHeight;

        this.points = this.progression.map(p => ({
            x: (p.time / this.maxTime) * w,
            yL: h - (p.local / this.maxScore) * h,
            yV: h - (p.visitor / this.maxScore) * h
        }));

        if (this.points.length > 0) {
            this.localPath = 'M ' + this.points.map(p => `${p.x},${p.yL}`).join(' L ');
            this.visitorPath = 'M ' + this.points.map(p => `${p.x},${p.yV}`).join(' L ');
            this.localArea = this.localPath + ` L ${this.points[this.points.length - 1].x},${h} L 0,${h} Z`;
        }
    }
}
