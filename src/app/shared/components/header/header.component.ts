import { Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly preferences = inject(PreferencesService);
  protected readonly app = environment.app;

  /** Pide abrir o cerrar el menú lateral. */
  readonly menuToggle = output<void>();

  protected readonly initials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return (
      name
        .split(/\s+/)
        .filter((part) => /^\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?'
    );
  });

  protected toggleTheme(): void {
    this.preferences.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
