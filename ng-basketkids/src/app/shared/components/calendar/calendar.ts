import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Match } from '../../../core/models/match.model';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css'],
  imports: [CommonModule]
})
export class Calendar {
  @Input() matches: Match[] = [];

  // Format dates directly or use an Angular Pipe in the template
}
