import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ProfileService } from '../../../core/services/profile.service';
import { DicebearUtil } from '../../../core/utils/dicebear.util';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrls: []
})
export class HeaderComponent {
  isMenuOpen = false;

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public profileService: ProfileService,
    private router: Router,
    private eRef: ElementRef
  ) { }

  get userDisplayName(): string {
    const profile = this.profileService.currentProfile;
    if (profile?.display_name) return profile.display_name;
    return this.auth.currentSession?.user?.email ?? '';
  }

  get isAdmin(): boolean {
    return this.profileService.currentProfile?.is_admin === true;
  }

  get userAvatar(): string {
    const seed = this.auth.currentSession?.user?.id || this.auth.currentSession?.user?.email;
    const config = this.profileService.currentProfile?.avatar_configs;
    return seed ? DicebearUtil.getAvatarUrl(seed, config as any, '5199e4') : '';
  }

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }

  async logout() {
    this.closeMenu();
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }
}

