import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './shared/services/auth.service';
import { HeaderComponent } from './shared/components/header/header.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ApiService } from './shared/services/api.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly api = inject(ApiService);
  protected readonly apiUrl = environment.apiUrl;

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Abierto por defecto en escritorio y cerrado en móvil; se reajusta al cambiar de tamaño. */
  protected readonly sidebarOpen = linkedSignal(() => !this.isMobile());

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected onNavigate(): void {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  protected retryConnection(): void {
    location.reload();
  }
}
