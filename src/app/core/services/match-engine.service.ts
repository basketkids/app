import { Injectable } from '@angular/core';
import { Match, MatchEvent, EventType } from '../models/match.model';
import { PlayerStatistic } from '../models/player.model';

@Injectable({
    providedIn: 'root'
})
export class MatchEngineService {

    /**
     * Recalculates the total score from the raw events log.
     */
    recalculateScore(events: Record<string, MatchEvent>): { local: number, visitor: number } {
        let local = 0;
        let visitor = 0;

        Object.values(events || {}).forEach(event => {
            if (event.type === EventType.POINTS && event.quantity) {
                if (event.playerId === -2) {
                    visitor += event.quantity;
                } else {
                    local += event.quantity;
                }
            }
        });

        return { local, visitor };
    }

    /**
     * Rebuilds all individual player stats and valuation from the ground up using the event log.
     */
    getReconstructedStats(events: Record<string, MatchEvent>, playerIds: string[]): Record<string, PlayerStatistic> {
        const stats: Record<string, PlayerStatistic> = {};

        // Init empty stats for all players
        playerIds.forEach(id => {
            stats[id] = {
                points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
                t1m: 0, t1i: 0, t2m: 0, t2i: 0, t3m: 0, t3i: 0,
                valoracion: 0, plusMinus: 0
            };
        });

        Object.values(events || {}).forEach(ev => {
            if (ev.playerId === -2 || !stats[ev.playerId]) return;
            const s = stats[ev.playerId as string];
            const val = ev.quantity || 1;

            switch (ev.type) {
                case EventType.POINTS:
                    s.points += val;
                    if (val === 1) { s.t1m++; s.t1i++; }
                    else if (val === 2) { s.t2m++; s.t2i++; }
                    else if (val === 3) { s.t3m++; s.t3i++; }
                    break;
                case EventType.MISS:
                    if (val === 1) s.t1i++;
                    else if (val === 2) s.t2i++;
                    else if (val === 3) s.t3i++;
                    break;
                case EventType.FOULS:
                    s.fouls += val;
                    break;
                case EventType.ASSISTS:
                    s.assists += val;
                    break;
                case EventType.REBOUNDS:
                    s.rebounds += val;
                    break;
                case EventType.STEALS:
                    s.steals += val;
                    break;
                case EventType.BLOCKS:
                    s.blocks += val;
                    break;
            }
        });

        // Recalculate valuations
        Object.values(stats).forEach(s => {
            s.valoracion = s.points + s.rebounds + s.assists + s.steals + s.blocks
                - s.fouls - (s.t1i - s.t1m) - (s.t2i - s.t2m) - (s.t3i - s.t3m);
        });

        return stats;
    }

    /**
     * Calculates total fouls for a specific team in a given quarter.
     * Team local: playerId != -2
     * Team visitor: playerId == -2
     */
    getTeamFouls(events: Record<string, MatchEvent>, quarter: number, isLocal: boolean): number {
        return Object.values(events || {})
            .filter(ev => ev.quarter === quarter && ev.type === EventType.FOULS && (isLocal ? ev.playerId !== -2 : ev.playerId === -2))
            .reduce((total, ev) => total + (ev.quantity || 1), 0);
    }

    /**
     * Validates if a substitution is legal.
     */
    canSubstitutePlayer(match: Match, playerIdIn: string): boolean {
        const onCourtCount = Object.keys(match.playersOnCourt || {}).length;
        // Basic basketball rule: no more than 5 players on court
        return onCourtCount < 5 || match.playersOnCourt[playerIdIn] === true;
    }

    /**
     * Calculates score progression through the match events.
     */
    getMatchProgression(events: Record<string, MatchEvent>): { time: number, local: number, visitor: number }[] {
        const sorted = Object.values(events || {}).sort((a, b) => {
            const qa = a.quarter || 1;
            const qb = b.quarter || 1;
            if (qa !== qb) return qa - qb;
            return b.secondsRemaining - a.secondsRemaining;
        });

        const progression = [{ time: 0, local: 0, visitor: 0 }];
        let curLocal = 0;
        let curVisitor = 0;

        sorted.forEach(ev => {
            if (ev.type === EventType.POINTS && ev.quantity) {
                if (ev.playerId === -2) curVisitor += ev.quantity;
                else curLocal += ev.quantity;

                // Time in match (assuming 10min quarters)
                const q = (ev.quarter || 1) - 1;
                const timeInMatch = (q * 600) + (600 - (ev.secondsRemaining || 0));
                progression.push({ time: timeInMatch, local: curLocal, visitor: curVisitor });
            }
        });

        return progression;
    }

    /**
     * Calculates points per quarter.
     */
    getQuarterPartials(events: Record<string, MatchEvent>): { quarter: number, local: number, visitor: number }[] {
        const partials: Record<number, { quarter: number, local: number, visitor: number }> = {};

        Object.values(events || {}).forEach(ev => {
            if (ev.type === EventType.POINTS && ev.quantity) {
                const q = ev.quarter || 1;
                if (!partials[q]) partials[q] = { quarter: q, local: 0, visitor: 0 };
                if (ev.playerId === -2) partials[q].visitor += ev.quantity;
                else partials[q].local += ev.quantity;
            }
        });

        return Object.values(partials).sort((a, b) => a.quarter - b.quarter);
    }

    /**
     * Calculates performance for each unique 5-player lineup.
     */
    getLineupPerformance(events: Record<string, MatchEvent>, initialLineup: string[]): { lineup: string[], pointsFor: number, pointsAgainst: number, diff: number }[] {
        const sorted = Object.values(events || {}).sort((a, b) => {
            const qa = a.quarter || 1;
            const qb = b.quarter || 1;
            if (qa !== qb) return qa - qb;
            return b.secondsRemaining - a.secondsRemaining;
        });

        const lineupStats: Record<string, { lineup: string[], pointsFor: number, pointsAgainst: number }> = {};
        const currentLineup = new Set<string>(initialLineup);

        const getLineupKey = () => Array.from(currentLineup).sort().join('|');

        sorted.forEach(ev => {
            const key = getLineupKey();
            if (currentLineup.size === 5) {
                if (!lineupStats[key]) lineupStats[key] = { lineup: Array.from(currentLineup), pointsFor: 0, pointsAgainst: 0 };
            }

            if (ev.type === EventType.POINTS && ev.quantity) {
                if (lineupStats[key]) {
                    if (ev.playerId === -2) lineupStats[key].pointsAgainst += ev.quantity;
                    else lineupStats[key].pointsFor += ev.quantity;
                }
            } else if (ev.type === EventType.SUBSTITUTION) {
                const pid = String(ev.playerId);
                if (currentLineup.has(pid)) currentLineup.delete(pid);
                else currentLineup.add(pid);
            }
        });

        return Object.values(lineupStats).map(s => ({
            ...s,
            diff: s.pointsFor - s.pointsAgainst
        })).sort((a, b) => b.diff - a.diff);
    }
}
