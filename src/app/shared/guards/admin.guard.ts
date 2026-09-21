import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate, CanActivateChild {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (this.authService.isAuthenticated()) {
      // ✅ Solo requiere estar autenticado, cualquier usuario puede entrar
      return true;
    } else {
      // Redirige a login si no está autenticado
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: route.url.join('/') } 
      });
      return false;
    }
  }

  canActivateChild(route: ActivatedRouteSnapshot): boolean {
    return this.canActivate(route);
  }
}