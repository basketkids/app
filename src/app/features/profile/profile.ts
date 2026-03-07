import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileRepository, UserProfile } from '../../core/models/data/profile.repository';
import { AvatarConfigRepository, AvatarConfig } from '../../core/models/data/avatar-config.repository';
import { AvatarEditor } from '../../shared/components/avatar-editor/avatar-editor';
import { AuthService } from '../../core/services/auth.service';


@Component({
    selector: 'app-profile',
    imports: [CommonModule, FormsModule, AvatarEditor],
    templateUrl: './profile.html'
})
export class Profile implements OnInit {
    profile: UserProfile | null = null;
    loading = true;
    saving = false;
    successMsg = '';
    errorMsg = '';

    // Working copy of the avatar configuration
    currentAvatarConfig: AvatarConfig = {};

    constructor(
        private profileRepo: ProfileRepository,
        private avatarRepo: AvatarConfigRepository,
        public auth: AuthService
    ) { }

    async ngOnInit() {
        await this.loadProfile();
    }

    async loadProfile() {
        this.loading = true;
        try {
            const userId = this.auth.currentSession?.user?.id;
            if (!userId) return;

            this.profile = await this.profileRepo.getProfile(userId);
            if (this.profile && this.profile.avatar_configs) {
                this.currentAvatarConfig = { ...this.profile.avatar_configs };
            }
        } catch (e: any) {
            this.errorMsg = e.message;
        } finally {
            this.loading = false;
        }
    }

    onAvatarConfigChange(newConfig: AvatarConfig) {
        this.currentAvatarConfig = newConfig;
    }

    async saveProfile() {
        if (!this.profile) return;
        this.saving = true;
        this.successMsg = '';
        this.errorMsg = '';

        try {
            const userId = this.profile.id;

            // 1. Save Avatar Config
            const configId = await this.avatarRepo.upsertConfig(
                this.currentAvatarConfig,
                this.profile.avatar_config_id
            );

            // 2. Save Profile Info (including linked config ID)
            if (configId) {
                this.profile.avatar_config_id = configId;
            }

            const success = await this.profileRepo.updateProfile(userId, {
                display_name: this.profile.display_name,
                avatar_config_id: this.profile.avatar_config_id
            });

            if (success) {
                this.successMsg = 'Perfil guardado con éxito.';
                // Refresh local cache/state if needed
                this.profile.avatar_configs = { ...this.currentAvatarConfig };
            } else {
                this.errorMsg = 'Error al guardar el perfil.';
            }
        } catch (e: any) {
            this.errorMsg = e.message;
        } finally {
            this.saving = false;
            setTimeout(() => this.successMsg = '', 3000);
        }
    }
}
