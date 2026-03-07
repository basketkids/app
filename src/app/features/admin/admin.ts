import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileRepository, UserProfile } from '../../core/models/data/profile.repository';
import { ProfileService } from '../../core/services/profile.service';
import { DicebearUtil } from '../../core/utils/dicebear.util';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-admin',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './admin.html'
})
export class Admin implements OnInit {
    users: UserProfile[] = [];
    loading = true;
    error = '';
    currentUserId = '';

    editingUserId: string | null = null;
    editingName = '';

    constructor(
        private profileRepo: ProfileRepository,
        public profileService: ProfileService,
        private router: Router,
        private auth: AuthService
    ) { }

    async ngOnInit() {
        if (!this.profileService.currentProfile?.is_admin) {
            this.router.navigate(['/home']);
            return;
        }
        this.currentUserId = this.auth.currentSession?.user?.id ?? '';
        await this.loadUsers();
    }

    async loadUsers() {
        this.loading = true;
        try {
            const all = await this.profileRepo.getAllProfiles();
            // Admins first, then alphabetical
            this.users = all.sort((a: UserProfile, b: UserProfile) => {
                if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
                return (a.display_name ?? '').localeCompare(b.display_name ?? '');
            });
        } catch (e: any) {
            this.error = e.message;
        } finally {
            this.loading = false;
        }
    }

    getAvatar(user: UserProfile): string {
        return DicebearUtil.getAvatarUrl(user.id, user.avatar_configs as any, '5199e4');
    }

    isCurrentUser(uid: string): boolean {
        return uid === this.currentUserId;
    }

    async toggleAdmin(user: UserProfile) {
        if (this.isCurrentUser(user.id)) return;
        const newStatus = !user.is_admin;
        const msg = newStatus ? 'dar permisos de administrador' : 'quitar permisos de administrador';
        if (!confirm(`¿Estás seguro de que quieres ${msg} a este usuario?`)) return;
        await this.profileRepo.setAdminStatus(user.id, newStatus);
        await this.loadUsers();
    }

    startEditName(user: UserProfile) {
        this.editingUserId = user.id;
        this.editingName = user.display_name;
    }

    cancelEdit() {
        this.editingUserId = null;
        this.editingName = '';
    }

    async saveEditName() {
        if (!this.editingUserId || !this.editingName.trim()) return;
        await this.profileRepo.updateDisplayName(this.editingUserId, this.editingName.trim());
        this.cancelEdit();
        await this.loadUsers();
    }

    async deleteUser(user: UserProfile) {
        if (user.is_admin || this.isCurrentUser(user.id)) return;
        if (!confirm(`¿Estás seguro de que quieres borrar a "${user.display_name}"? Esta acción eliminará su perfil y datos asociados.`)) return;
        await this.profileRepo.deleteProfile(user.id);
        await this.loadUsers();
    }
}
