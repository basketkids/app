export interface PlayerStatistic {
    points: number;
    fouls: number;
    assists: number;
    rebounds: number;
    steals: number;
    blocks: number;
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
