import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly THEME_KEY = 'basketkids_theme';

    // Initialize with dark as default to match legacy behavior
    public currentTheme = signal<ThemeMode>('dark');

    constructor() {
        this.initTheme();
    }

    toggleTheme(): void {
        const nextTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
    }

    setTheme(theme: ThemeMode): void {
        this.currentTheme.set(theme);
        localStorage.setItem(this.THEME_KEY, theme);
        this.applyThemeClass(theme);
    }

    private initTheme(): void {
        const savedTheme = localStorage.getItem(this.THEME_KEY) as ThemeMode | null;
        if (savedTheme === 'light' || savedTheme === 'dark') {
            this.currentTheme.set(savedTheme);
            this.applyThemeClass(savedTheme);
        } else {
            // Check system preference if no saved theme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = prefersDark ? 'dark' : 'light';
            this.currentTheme.set(initialTheme);
            this.applyThemeClass(initialTheme);
        }
    }

    private applyThemeClass(theme: ThemeMode): void {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
}
