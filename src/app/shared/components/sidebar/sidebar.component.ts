import { Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav aria-label="Navegación principal">
      <ul>
        @for (item of items; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              (click)="navigate.emit()"
            >
              <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      padding: 12px 8px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 999px;
      color: var(--mat-sys-on-surface-variant);
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      background: var(--mat-sys-surface-container-high);
    }
    a:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    a.active {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
  `,
})
export class SidebarComponent {
  /** Se emite al elegir una opción (para cerrar el menú en móvil). */
  readonly navigate = output<void>();

  protected readonly items: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/inventory', label: 'Inventario', icon: 'inventory_2' },
    { path: '/categories', label: 'Categorías', icon: 'category' },
    { path: '/stock-alerts', label: 'Alertas de stock', icon: 'notification_important' },
    { path: '/orders', label: 'Órdenes', icon: 'receipt_long' },
    { path: '/reports', label: 'Reportes', icon: 'bar_chart' },
    { path: '/settings', label: 'Configuración', icon: 'settings' },
  ];
}
