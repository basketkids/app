import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProfileRepository, UserProfile } from '../../core/models/data/profile.repository';
import { ProfileService } from '../../core/services/profile.service';
import { AdminRepository } from '../../core/models/data/admin.repository';

interface UserStat {
    profile: UserProfile;
    teams: any[];
    teamCount: number;
    matchCount: number;
}

@Component({
    selector: 'app-admin-stats',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-stats.html'
})
export class AdminStats implements OnInit {
    stats: UserStat[] = [];
    loading = true;
    error = '';

    // Modal state
    selectedUser: UserStat | null = null;
    selectedTeamId: string | null = null;
    teamMatches: { [teamId: string]: any[] } = {};
    compMap: { [compId: string]: any } = {};

    constructor(
        private profileRepo: ProfileRepository,
        private profileService: ProfileService,
        private router: Router,
        private adminRepo: AdminRepository
    ) { }

    async ngOnInit() {
        if (!this.profileService.currentProfile?.is_admin) {
            this.router.navigate(['/home']);
            return;
        }
        await this.loadStats();
    }

    async loadStats() {
        this.loading = true;
        try {
            const { profiles, teams, competitions, matches } = await this.adminRepo.getGlobalStats();

            // Build stat map
            const statMap: { [id: string]: UserStat } = {};
            (profiles ?? []).forEach((p: UserProfile) => {
                statMap[p.id] = { profile: p, teams: [], teamCount: 0, matchCount: 0 };
            });

            (teams ?? []).forEach((t: any) => {
                if (statMap[t.owner_id]) {
                    statMap[t.owner_id].teams.push(t);
                    statMap[t.owner_id].teamCount++;
                }
            });

            const teamMatchCount: { [tid: string]: number } = {};
            this.teamMatches = {};
            (matches ?? []).forEach((m: any) => {
                teamMatchCount[m.team_id] = (teamMatchCount[m.team_id] ?? 0) + 1;
                if (!this.teamMatches[m.team_id]) this.teamMatches[m.team_id] = [];
                this.teamMatches[m.team_id].push(m);
            });

            Object.values(statMap).forEach(u => {
                u.teams.forEach((t: any) => {
                    u.matchCount += teamMatchCount[t.id] ?? 0;
                });
            });

            this.compMap = {};
            (competitions ?? []).forEach((c: any) => this.compMap[c.id] = c);

            this.stats = Object.values(statMap).sort((a, b) =>
                (a.profile.display_name ?? '').localeCompare(b.profile.display_name ?? ''));
        } catch (e: any) {
            this.error = e.message;
        } finally {
            this.loading = false;
        }
    }

    openTeams(user: UserStat) {
        this.selectedUser = user;
        this.selectedTeamId = null;
    }

    openMatches(teamId: string) {
        this.selectedTeamId = teamId;
    }

    backToTeams() {
        this.selectedTeamId = null;
    }

    closeModal() {
        this.selectedUser = null;
        this.selectedTeamId = null;
    }

    get selectedTeamMatches(): any[] {
        if (!this.selectedTeamId) return [];
        return (this.teamMatches[this.selectedTeamId] ?? []).sort((a: any, b: any) =>
            new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
    }

    get selectedTeam(): any {
        return this.selectedUser?.teams.find((t: any) => t.id === this.selectedTeamId);
    }

    formatDate(date: string): string {
        try { return new Date(date).toLocaleDateString('es-ES'); } catch { return '—'; }
    }

    async deleteTeam(teamId: string) {
        if (!confirm('¿Borrar este equipo? Se borrarán también sus partidos y jugadores.')) return;
        try {
            await this.adminRepo.deleteTeam(teamId);
            this.closeModal();
            await this.loadStats();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    }

    async deleteMatch(matchId: string) {
        if (!confirm('¿Borrar este partido?')) return;
        try {
            await this.adminRepo.deleteMatch(matchId);
            this.closeModal();
            await this.loadStats();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    }
}
