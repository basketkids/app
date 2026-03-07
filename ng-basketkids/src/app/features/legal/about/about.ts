import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileRepository, UserProfile } from '../../../core/models/data/profile.repository';
import { DicebearUtil } from '../../../core/utils/dicebear.util';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: []
})
export class About implements OnInit {
  admins: UserProfile[] = [];
  loading = true;

  constructor(private profileRepo: ProfileRepository) { }

  async ngOnInit() {
    this.admins = await this.profileRepo.getAdmins();
    this.loading = false;
  }

  getAdminAvatar(admin: UserProfile): string {
    if (admin.photo_url) return admin.photo_url;
    // Fallback to dicebear
    return DicebearUtil.getAvatarUrl(admin.id, admin.avatar_configs as any, '5199e4');
  }

  getAdminName(admin: UserProfile): string {
    return admin.display_name || admin.email || 'Admin';
  }
}
