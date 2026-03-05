import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CalendarService, CalendarMatch } from '../../core/services/calendar.service';

@Component({
    selector: 'app-public-matches',
    imports: [CommonModule, RouterModule],
    templateUrl: './public-matches.html',
    styleUrls: ['./public-matches.css']
})
export class PublicMatches implements OnInit {
    matches: CalendarMatch[] = [];
    loading = true;
    errorMsg = '';

    constructor(private calService: CalendarService, private router: Router) { }

    async ngOnInit(): Promise<void> {
        try {
            this.matches = await this.calService.getPublicMatches();
        } catch (e) {
            this.errorMsg = (e as Error).message;
        } finally {
            this.loading = false;
        }
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
