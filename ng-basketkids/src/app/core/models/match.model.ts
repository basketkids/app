import { MatchEvent, EventType } from './event.model';
export type { MatchEvent };
export { EventType };
import { PlayerRosterData, PlayerStatistic } from './player.model';

export enum MatchState {
    SCHEDULED = 'programado',
    IN_PROGRESS = 'en curso',
    FINISHED = 'finalizado'
}

export interface MatchTimerState {
    active: boolean;
    remainingSeconds: number;
}

export interface Match {
    id: string;
    teamId?: string;
    competitionId?: string;
    state: MatchState;
    date: string | null;
    venue: string | null;
    localTeamName: string;
    visitorTeamName: string;
    isLocal: boolean;
    scoreLocal: number;
    scoreVisitor: number;
    currentQuarter: number;
    timerState: MatchTimerState;
    events: Record<string, MatchEvent>;
    stats: Record<string, PlayerStatistic>;
    roster: Record<string, PlayerRosterData>; // Players with stats in THIS match
    plantilla: Record<string, PlayerRosterData>; // All players in the TEAM
    convocados: Record<string, PlayerRosterData>; // Players summoned to THIS match
    playersOnCourt: Record<string, boolean>; // Dictionary of IDs currently playing
    chronicle?: string | null;
}
