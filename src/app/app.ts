import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav';
import { Footer } from './shared/components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, HeaderComponent, BottomNavComponent, Footer],
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

}
