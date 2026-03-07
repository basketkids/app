import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchTimerState } from '../../../core/models/match.model';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  templateUrl: './scoreboard.html',
  styleUrls: ['./scoreboard.css'],
  imports: [CommonModule]
})
export class Scoreboard {
  @Input() localScore: number = 0;
  @Input() visitorScore: number = 0;
  @Input() localName: string = 'Local';
  @Input() visitorName: string = 'Visitante';
  @Input() quarter: number = 1;
  @Input() timerState: MatchTimerState = { active: false, remainingSeconds: 600 };

  get formattedTime(): string {
    const seconds = this.timerState?.remainingSeconds ?? 600;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
}
