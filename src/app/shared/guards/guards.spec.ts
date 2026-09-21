import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';

describe('guards', () => {
  const auth = { isAuthenticated: vi.fn(), isAdmin: vi.fn() };

  beforeEach(() => {
    auth.isAuthenticated.mockReset();
    auth.isAdmin.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  const run = (guard: typeof authGuard, url = '/inventory') =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );

  it('authGuard deja pasar a un usuario autenticado', () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(run(authGuard)).toBe(true);
  });

  it('authGuard manda al login recordando la ruta pedida', () => {
    auth.isAuthenticated.mockReturnValue(false);
    const result = run(authGuard, '/inventory?edit=3') as UrlTree;
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Finventory%3Fedit%3D3');
  });

  it('adminGuard exige el rol de administrador', () => {
    auth.isAdmin.mockReturnValue(true);
    expect(run(adminGuard)).toBe(true);

    auth.isAdmin.mockReturnValue(false);
    const result = run(adminGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?reason=forbidden');
  });
});
