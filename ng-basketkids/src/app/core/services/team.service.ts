import { Injectable, OnDestroy } from '@angular/core';
import { TeamRepository } from '../models/data/team.repository';
import { Team } from '../models/team.model';

export type { Team };

export interface FollowedTeam {
    team_id: string;
    teams: {
        id: string;
        name: string;
        owner_id: string;
    };
}

@Injectable({ providedIn: 'root' })
export class TeamService implements OnDestroy {
    private subscription: { unsubscribe: () => void } | null = null;

    constructor(
        private repository: TeamRepository
    ) { }

    async getMyTeams(userId: string): Promise<Team[]> {
        console.log('[TeamService] getMyTeams — querying owner_id =', userId);
        const data = await this.repository.getTeamsByUser(userId);
        console.log('[TeamService] ✅ getMyTeams result:', data.length, 'rows', data);
        return data;
    }

    subscribeToTeams(userId: string, callback: (teams: Team[]) => void): { unsubscribe: () => void } {
        // Initial fetch
        this.getMyTeams(userId).then(callback).catch(console.error);

        const sub = this.repository.subscribeToTeams(userId, () => {
            this.getMyTeams(userId).then(callback).catch(console.error);
        });

        // Keep local reference to clean up on destroy globally if needed
        this.subscription = sub;

        return sub;
    }

    async getFollowedTeams(userId: string): Promise<FollowedTeam[]> {
        const data = await this.repository.getFollowedTeams(userId);
        return data as unknown as FollowedTeam[];
    }

    async create(userId: string, name: string): Promise<Team | null> {
        return this.repository.createTeam(userId, name);
    }

    async delete(teamId: string): Promise<void> {
        await this.repository.deleteTeam(teamId);
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }
}
