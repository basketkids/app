import { Injectable } from '@angular/core';
import { MatchRepository } from '../models/data/match.repository';
import { TeamService } from './team.service';
import { Match } from '../models/match.model';

export interface CalendarMatch extends Match {
    team_name: string;
    team_score: number;
    rival_score: number;
    rival_name: string;
    location: string;
    is_local: boolean;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
    constructor(
        private matchRepo: MatchRepository,
        private teamService: TeamService
    ) { }

    async getAllUserMatches(userId: string): Promise<CalendarMatch[]> {
        const owned = await this.teamService.getMyTeams(userId);
        const followed = await this.teamService.getFollowedTeams(userId);

        const teamMap = new Map<string, string>();
        owned.forEach(t => teamMap.set(t.id, t.name));
        followed.forEach(f => {
            if (f.teams) teamMap.set(f.team_id, f.teams.name);
        });

        if (teamMap.size === 0) return [];

        const matches = await this.matchRepo.getMatchesByTeams([...teamMap.keys()]);

        return matches.map(m => {
            const teamId = m.teamId || '';
            const tName = teamMap.get(teamId) || 'Desconocido';
            return {
                ...m,
                team_name: tName,
                // Optional duplicate props to satisfy old UI bindings if needed:
                team_id: teamId,
                competition_id: m.competitionId || '',
                rival_name: m.isLocal ? m.visitorTeamName : m.localTeamName,
                location: m.venue || '',
                is_local: m.isLocal,
                team_score: m.isLocal ? m.scoreLocal : m.scoreVisitor,
                rival_score: m.isLocal ? m.scoreVisitor : m.scoreLocal
            } as unknown as CalendarMatch;
        });
    }

    async getPublicMatches(): Promise<CalendarMatch[]> {
        // Fallback or simple logic to fetch global matches if required.
        // Needs a specialized view or we fetch all matches with limits via repo if exposed.
        // For simplicity now, we mock or return empty if not formally implemented yet in repo.
        console.warn('getPublicMatches not fully migrated to repo logic yet');
        return [];
    }

    /** Returns today at 00:00 */
    getTodayStart(): Date {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** Group matches into a Map<dateKey, matches[]> where dateKey = 'YYYY-MM-DD' */
    groupByDay(matches: CalendarMatch[]): Map<string, CalendarMatch[]> {
        const map = new Map<string, CalendarMatch[]>();
        matches.forEach(m => {
            if (!m.date) return;
            const key = m.date.substring(0, 10); // 'YYYY-MM-DD'
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(m);
        });
        return map;
    }

    /** Returns array of date strings for the next N days from startDate */
    getDayRange(startDate: Date, days: number): string[] {
        return Array.from({ length: days }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            return d.toISOString().substring(0, 10);
        });
    }

    /** Returns array of date strings for the whole month of a given date */
    getMonthDays(date: Date): string[] {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month, i + 1);
            return d.toISOString().substring(0, 10);
        });
    }

    formatDayHeader(dateStr: string): { weekday: string; dayNum: number; isToday: boolean } {
        const d = new Date(dateStr + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return {
            weekday: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase(),
            dayNum: d.getDate(),
            isToday: d.getTime() === today.getTime()
        };
    }

    formatTime(dateStr: string): string {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    getMonthLabel(date: Date): string {
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
}
