import { Routes } from '@angular/router';
import { AdminGuard } from './shared/guards/admin.guard';
import { authGuard } from './shared/guards/auth.guard';

/**
 * Rutas raíz. Cada módulo se carga bajo demanda, así que sumar uno nuevo
 * (p. ej. una tienda pública) es agregar aquí su `loadChildren`.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    title: 'Iniciar sesión',
    loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard, AdminGuard],
    loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
