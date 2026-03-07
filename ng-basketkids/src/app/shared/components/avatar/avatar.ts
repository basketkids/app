import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DicebearUtil } from '../../../core/utils/dicebear.util';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css']
})
export class Avatar implements OnChanges {
  @Input() seed: string = 'default-seed';
  @Input() config: Record<string, string | number> | null = null;
  @Input() size: number = 50;
  @Input() jerseyColor: string = '5199e4';

  avatarUrl: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['seed'] || changes['config'] || changes['jerseyColor']) {
      this.updateAvatarUrl();
    }
  }

  private updateAvatarUrl(): void {
    this.avatarUrl = DicebearUtil.getAvatarUrl(
      this.seed,
      this.config,
      this.jerseyColor
    );
  }
}
