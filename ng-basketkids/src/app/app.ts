import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  isLoginPage = false;
  isDarkMode = false;

  constructor(public auth: AuthService, private router: Router) {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.isLoginPage = e.urlAfterRedirects.startsWith('/login');
    });
  }

  ngOnInit(): void {
    // Restore theme preference
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      this.setDarkMode(true);
    }
  }

  toggleTheme(): void {
    this.setDarkMode(!this.isDarkMode);
  }

  private setDarkMode(dark: boolean): void {
    this.isDarkMode = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }

  get userEmail(): string {
    return this.auth.currentSession?.user?.email ?? '';
  }

  get userAvatar(): string {
    const email = this.userEmail;
    return email
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random&size=50`
      : '';
  }

  signOut(): void {
    this.auth.signOut().then(() => this.router.navigate(['/login']));
  }
}
