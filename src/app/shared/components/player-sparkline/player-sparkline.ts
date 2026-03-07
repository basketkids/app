import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SparklineSeries {
    label: string;
    color: string;
    values: number[];
    dates: string[];
}

@Component({
    selector: 'app-player-sparkline',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="series.length > 0" class="flex flex-col gap-4 w-full">
        <div *ngFor="let s of series" class="bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 rounded-xl p-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold uppercase tracking-wider" [style.color]="s.color">{{ s.label }}</span>
                <span class="text-lg font-black tabular-nums" [style.color]="s.color">{{ fmt(avg(s.values)) }}
                    <span class="text-[10px] font-normal text-slate-400">/pj</span>
                </span>
            </div>
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" class="w-full" style="height:56px">
                <defs>
                    <linearGradient [id]="'sg-' + s.label" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" [attr.stop-color]="s.color" stop-opacity="0.3"/>
                        <stop offset="100%" [attr.stop-color]="s.color" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <!-- Zero / mid baseline -->
                <line [attr.x1]="0" [attr.y1]="H" [attr.x2]="W" [attr.y2]="H" stroke-width="0.5" class="text-slate-200 dark:text-white/10" [attr.stroke]="'currentColor'"/>
                <!-- Area -->
                <path [attr.d]="areaPath(s)" [attr.fill]="'url(#sg-' + s.label + ')'"/>
                <!-- Line -->
                <path [attr.d]="linePath(s)" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
                <!-- Dots -->
                <circle *ngFor="let p of points(s); let i = index"
                    [attr.cx]="p.x" [attr.cy]="p.y" r="3"
                    [attr.fill]="s.color" stroke="white" stroke-width="1.5"
                    vector-effect="non-scaling-stroke"/>
            </svg>
            <!-- X axis labels -->
            <div class="flex justify-between text-[9px] text-slate-400 dark:text-slate-600 mt-1 px-0.5">
                <span *ngFor="let d of s.dates">{{ d }}</span>
            </div>
        </div>
    </div>
    `
})
export class PlayerSparklineComponent implements OnChanges {
    @Input() series: SparklineSeries[] = [];

    readonly W = 400;
    readonly H = 56;

    ngOnChanges(): void { /* triggers re-render */ }

    avg(values: number[]): number {
        if (!values.length) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    fmt(v: number): string {
        return v % 1 === 0 ? String(v) : v.toFixed(1);
    }

    points(s: SparklineSeries): { x: number; y: number }[] {
        const vals = s.values;
        if (!vals.length) return [];
        const max = Math.max(...vals, 1);
        const len = Math.max(vals.length, 2);
        const step = vals.length === 1 ? this.W / 2 : this.W / (len - 1);
        return vals.map((v, i) => ({
            x: vals.length === 1 ? this.W / 2 : i * step,
            y: this.H - (v / max) * (this.H - 4)
        }));
    }

    linePath(s: SparklineSeries): string {
        const pts = this.points(s);
        if (!pts.length) return '';
        return 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
    }

    areaPath(s: SparklineSeries): string {
        const pts = this.points(s);
        if (!pts.length) return '';
        return this.linePath(s) + ` L ${pts[pts.length - 1].x},${this.H} L ${pts[0].x},${this.H} Z`;
    }
}
