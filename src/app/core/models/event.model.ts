export enum EventType {
    POINTS = 'puntos',
    FOULS = 'faltas',
    SUBSTITUTION = 'cambio',
    ASSISTS = 'asistencias',
    REBOUNDS = 'rebotes',
    STEALS = 'robos',
    BLOCKS = 'tapones',
    MISS = 'fallo'
}

export interface MatchEvent {
    id: string;
    type: EventType;
    quarter: number;
    secondsRemaining: number;
    playerId: string | -2; // -2 implies rival team
    playerName?: string;
    playerDorsal?: number;
    quantity: number | null; // e.g. 1, 2, or 3 points
    detail: string | null;
}
