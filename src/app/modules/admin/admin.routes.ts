import { Routes } from '@angular/router';

/** Rutas privadas del panel. El acceso lo protegen `authGuard` y `adminGuard` en la ruta padre. */
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
    path: 'inventory',
    title: 'Inventario',
    loadComponent: () =>
      import('./components/inventory-management/inventory-management.component').then(
        (m) => m.InventoryManagementComponent,
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
    path: 'settings',
    title: 'Configuración',
    loadComponent: () =>
      import('./components/admin-settings/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
  },
];
