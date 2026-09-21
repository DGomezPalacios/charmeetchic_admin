import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService, isFirebaseConfigured } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly app = environment.app;
  protected readonly firebaseReady = isFirebaseConfigured();
  protected readonly environment = environment; // Para usar en template

  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  private readonly pending = signal(0);
  protected readonly busy = computed(() => this.pending() > 0);

  // 🎯 Toggle Demo: Admin/No Admin
  protected readonly demoAdminMode = signal(false);

  protected readonly notice = computed(() => {
    if (this.auth.authError()) {
      return this.auth.authError();
    }
    switch (this.reason()) {
      case 'expired':
        return 'Tu sesión expiró. Inicia sesión nuevamente.';
      case 'forbidden':
        return 'No tienes permiso para acceder a este recurso.';
      default:
        return null;
    }
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.safeReturnUrl());
    }
  }

  protected async login(): Promise<void> {
    this.pending.update((n) => n + 1);
    try {
      await this.auth.login();

      // 🎯 DEMO: Inyecta rol ADMIN según el toggle (solo desarrollo)
      if (this.demoAdminMode() && !environment.production) {
        const user = this.auth.getUser();
        if (user) {
          user.roles = [environment.adminRole];
        }
      }

      if (this.auth.isAuthenticated()) {
        await this.router.navigateByUrl(this.safeReturnUrl());
      }
    } finally {
      this.pending.update((n) => n - 1);
    }
  }

  protected logout(): void {
    void this.auth.logout();
  }

  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login')
      ? url
      : '/dashboard';
  }
}