import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ContactMessagesRepository, ContactMessage } from '../../core/models/data/contact-messages.repository';
import { ProfileService } from '../../core/services/profile.service';

@Component({
    selector: 'app-admin-messages',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-messages.html'
})
export class AdminMessages implements OnInit {
    allMessages: ContactMessage[] = [];
    loading = true;
    filter: 'inbox' | 'archived' = 'inbox';
    currentPage = 1;
    readonly pageSize = 20;

    constructor(
        private messagesRepo: ContactMessagesRepository,
        private profileService: ProfileService,
        private router: Router
    ) { }

    async ngOnInit() {
        if (!this.profileService.currentProfile?.is_admin) {
            this.router.navigate(['/home']);
            return;
        }
        await this.loadMessages();
    }

    async loadMessages() {
        this.loading = true;
        try {
            this.allMessages = await this.messagesRepo.getMessages();
        } finally {
            this.loading = false;
        }
    }

    get filtered(): ContactMessage[] {
        return this.allMessages.filter(m => this.filter === 'inbox' ? !m.archived : m.archived);
    }

    get page(): ContactMessage[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filtered.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    }

    setFilter(f: 'inbox' | 'archived') {
        this.filter = f;
        this.currentPage = 1;
    }

    async markRead(msg: ContactMessage) {
        await this.messagesRepo.markAsRead(msg.id);
        msg.read = true;
    }

    async archive(msg: ContactMessage) {
        if (!confirm('¿Archivar este mensaje?')) return;
        await this.messagesRepo.archive(msg.id);
        msg.archived = true;
    }

    async unarchive(msg: ContactMessage) {
        await this.messagesRepo.unarchive(msg.id);
        msg.archived = false;
    }

    formatDate(dateStr: string): string {
        try { return new Date(dateStr).toLocaleString('es-ES'); } catch { return '—'; }
    }
}
