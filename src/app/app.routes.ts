import { Routes } from '@angular/router';
import { adminGuard } from './shared/guards/admin.guard';
import { authGuard } from './shared/guards/auth.guard';

/**
 * Rutas raíz. Cada módulo se carga bajo demanda, así que sumar uno nuevo
 * (p. ej. una tienda pública) es agregar aquí su `loadChildren`.
 *
 * - `/admin/*`: solo ADMIN (dashboard, categorías, alertas, órdenes, reportes, configuración).
 * - `/user/*`: cualquier usuario con sesión. El inventario es de solo lectura si no es ADMIN.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Iniciar sesión',
    loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'user',
    canActivate: [authGuard],
    children: [
      {
        path: 'inventory',
        title: 'Inventario',
        loadComponent: () =>
          import(
            './modules/admin/components/inventory-management/inventory-management.component'
          ).then((m) => m.InventoryManagementComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
