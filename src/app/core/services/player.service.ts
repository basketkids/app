import { Injectable } from '@angular/core';
import { PlayerRepository } from '../models/data/player.repository';
import { Player } from '../models/player.model';

export type { Player };

import { AvatarConfigRepository, AvatarConfig } from '../models/data/avatar-config.repository';

@Injectable({ providedIn: 'root' })
export class PlayerService {
    constructor(
        private repository: PlayerRepository,
        private avatarRepo: AvatarConfigRepository
    ) { }

    async getSquad(teamId: string): Promise<Player[]> {
        return this.repository.getPlayersByTeam(teamId);
    }

    async add(teamId: string, name: string, dorsal: string): Promise<Player | null> {
        return this.repository.createPlayer(teamId, { name, dorsal });
    }

    async update(playerId: string, data: Partial<Player>): Promise<Player | null> {
        return this.repository.updatePlayer(playerId, data);
    }

    async updatePlayerAndAvatar(playerId: string, data: Partial<Player>, avatarConfig: AvatarConfig, existingConfigId?: string): Promise<Player | null> {
        // 1. Upsert avatar
        const configId = await this.avatarRepo.upsertConfig(avatarConfig, existingConfigId);

        // 2. Update player
        return this.repository.updatePlayer(playerId, { ...data, avatar_config_id: configId || undefined });
    }

    async delete(playerId: string): Promise<void> {
        await this.repository.deletePlayer(playerId);
    }
}
