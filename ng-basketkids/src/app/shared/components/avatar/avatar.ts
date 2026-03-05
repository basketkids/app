import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css']
})
export class Avatar {
  @Input() config: Record<string, string | number> | null = null;
  @Input() size: number = 50;

  @ViewChild('avatarCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    if (this.config && this.canvasRef) {
      this.drawAvatar(this.config);
    }
  }

  // Pure drawing logic encapsulated inside the dumb component
  private drawAvatar(config: Record<string, string | number>): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Abstracting simple drawing: In actual implementation port the complex `drawDiceAvatar` logic
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.fillStyle = (config['color'] as string) || '#ccc';
    ctx.beginPath();
    ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
