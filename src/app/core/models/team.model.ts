export interface Team {
    id: string;
    name: string;
    coach: string | null;
    jerseyColor: string;
    owner_id: string;
    logo_url?: string | null;
    createdAt: string;
}
