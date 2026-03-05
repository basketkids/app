import { Injectable } from '@angular/core';
import { Match, MatchEvent, EventType } from '../models/match.model';

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
     * Validates if a substitution is legal.
     */
    canSubstitutePlayer(match: Match, playerIdIn: string): boolean {
        const onCourtCount = Object.keys(match.playersOnCourt || {}).length;
        // Basic basketball rule: no more than 5 players on court
        return onCourtCount < 5 || match.playersOnCourt[playerIdIn] === true;
    }
}
