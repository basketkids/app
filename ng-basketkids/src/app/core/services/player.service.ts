import { Injectable } from '@angular/core';
import { PlayerRepository } from '../models/data/player.repository';
import { Player } from '../models/player.model';

export type { Player };

@Injectable({ providedIn: 'root' })
export class PlayerService {
    constructor(private repository: PlayerRepository) { }

    async getSquad(teamId: string): Promise<Player[]> {
        return this.repository.getPlayersByTeam(teamId);
    }

    async add(teamId: string, name: string, dorsal: string): Promise<Player | null> {
        return this.repository.createPlayer(teamId, { name, dorsal });
    }

    async update(playerId: string, data: Partial<Player>): Promise<Player | null> {
        return this.repository.updatePlayer(playerId, data);
    }

    async delete(playerId: string): Promise<void> {
        await this.repository.deletePlayer(playerId);
    }
}
