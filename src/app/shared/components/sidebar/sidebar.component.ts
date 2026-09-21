import { Component, computed, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** Solo se muestra a usuarios con rol ADMIN. */
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav aria-label="Navegación principal">
      <ul>
        @for (item of items(); track item.path) {
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

  private readonly auth = inject(AuthService);
  private readonly isAdmin = computed(() => this.auth.isAdmin());

  private readonly allItems: NavItem[] = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'space_dashboard', adminOnly: true },
    { path: '/user/inventory', label: 'Inventario', icon: 'inventory_2' },
    { path: '/admin/categories', label: 'Categorías', icon: 'category', adminOnly: true },
    {
      path: '/admin/stock-alerts',
      label: 'Alertas de stock',
      icon: 'notification_important',
      adminOnly: true,
    },
    { path: '/admin/orders', label: 'Órdenes', icon: 'receipt_long', adminOnly: true },
    { path: '/admin/reports', label: 'Reportes', icon: 'bar_chart', adminOnly: true },
    { path: '/admin/settings', label: 'Configuración', icon: 'settings', adminOnly: true },
  ];

  /** Un usuario sin rol ADMIN solo ve "Inventario". */
  protected readonly items = computed(() =>
    this.allItems.filter((item) => !item.adminOnly || this.isAdmin()),
  );
}
