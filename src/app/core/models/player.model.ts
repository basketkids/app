export interface PlayerStatistic {
    points: number;
    fouls: number;
    assists: number;
    rebounds: number;
    steals: number;
    blocks: number;
    t1m: number; // Made 1pt
    t1i: number; // Attempted 1pt
    t2m: number; // Made 2pt
    t2i: number; // Attempted 2pt
    t3m: number; // Made 3pt
    t3i: number; // Attempted 3pt
    valoracion?: number;
    plusMinus?: number;
}

export interface PlayerRosterData {
    id: string;
    name: string;
    dorsal: number | string;
    avatarConfig: Record<string, string | number> | null;
}

export interface Player extends PlayerRosterData {
    teamId: string;
    position?: string;
    birthDate?: Date;
    height?: string;
    weight?: string;
}
