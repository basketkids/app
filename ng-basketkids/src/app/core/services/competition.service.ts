import { Injectable } from '@angular/core';
import { CompetitionRepository } from '../models/data/competition.repository';
import { MatchRepository } from '../models/data/match.repository';
import { Competition, Rival } from '../models/competition.model';
import { Match, MatchState } from '../models/match.model';

export { MatchState };
export type { Competition, Rival, Match };

@Injectable({ providedIn: 'root' })
export class CompetitionService {
    constructor(
        private compRepo: CompetitionRepository,
        private matchRepo: MatchRepository
    ) { }

    async getCompetition(compId: string): Promise<Competition | null> {
        return this.compRepo.getCompetitionById(compId);
    }

    async getCompetitionsByTeam(teamId: string): Promise<Competition[]> {
        return this.compRepo.getCompetitionsByTeam(teamId);
    }

    async createCompetition(teamId: string, name: string): Promise<Competition | null> {
        return this.compRepo.createCompetition(teamId, name);
    }

    async getMatches(compId: string): Promise<Match[]> {
        return this.matchRepo.getMatchesByCompetition(compId);
    }

    async createMatch(teamId: string, compId: string, match: Partial<Match>): Promise<Match | null> {
        const payload = { competition_id: compId, team_id: teamId, ...match };
        return this.matchRepo.createMatch(payload);
    }

    async deleteMatch(matchId: string): Promise<void> {
        await this.matchRepo.deleteMatch(matchId);
    }

    async getRivals(compId: string): Promise<Rival[]> {
        return this.compRepo.getRivalsByCompetition(compId);
    }

    async addRival(compId: string, name: string): Promise<Rival | null> {
        return this.compRepo.createRival(compId, name);
    }

    async deleteRival(rivalId: string): Promise<void> {
        await this.compRepo.deleteRival(rivalId);
    }
}
