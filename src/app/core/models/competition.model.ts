export interface Competition {
    id: string;
    teamId: string;
    name: string;
    season?: string;
    createdAt?: Date;
}

export interface Rival {
    id: string;
    competitionId: string;
    name: string;
    logoUrl?: string;
    createdAt?: Date;
}
