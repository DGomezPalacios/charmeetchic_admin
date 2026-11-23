import { Routes } from '@angular/router';
import { provideStreaming } from '../../shared/services/streaming.providers';

/**
 * Rutas del panel, bajo `/admin`. El acceso lo protegen `authGuard` y `adminGuard` en la ruta padre.
 * El inventario vive en `/user/inventory` (app.routes.ts) porque también lo ve un usuario sin rol ADMIN.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () =>
      import('./components/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'categories',
    title: 'Categorías',
    loadComponent: () =>
      import('./components/categories/categories.component').then((m) => m.CategoriesComponent),
  },
  {
    path: 'stock-alerts',
    title: 'Alertas de stock',
    loadComponent: () =>
      import('./components/stock-alerts/stock-alerts.component').then(
        (m) => m.StockAlertsComponent,
      ),
  },
  {
    path: 'orders',
    title: 'Órdenes',
    loadComponent: () =>
      import('./components/orders-list/orders-list.component').then((m) => m.OrdersListComponent),
  },
  {
    path: 'reports',
    title: 'Reportes de ventas',
    loadComponent: () =>
      import('./components/sales-reports/sales-reports.component').then(
        (m) => m.SalesReportsComponent,
      ),
  },
  {
    path: 'realtime',
    title: 'Tiempo real',
    // La instancia de StreamingService vive en el inyector de esta ruta (real o de ejemplo).
    providers: [provideStreaming()],
    loadComponent: () =>
      import('./components/realtime-dashboard/realtime-dashboard.component').then(
        (m) => m.RealtimeDashboardComponent,
      ),
  },
  {
    path: 'settings',
    title: 'Configuración',
    loadComponent: () =>
      import('./components/admin-settings/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
  },
];
