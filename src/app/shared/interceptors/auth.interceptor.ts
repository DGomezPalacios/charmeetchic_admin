import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SKIP_UNAUTHORIZED_HANDLING } from './http-context';

/**
 * Agrega el ID token de Firebase (`Authorization: Bearer <jwt>`) solo a las peticiones dirigidas a la
 * API, y gestiona los 401. El token se pide en cada petición: Firebase lo renueva solo al vencer.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  return auth.getToken().pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
    catchError((error: unknown) => {
      const unauthorized =
        (error instanceof HttpErrorResponse && error.status === 401) ||
        (error as { status?: number })?.status === 401;
      if (unauthorized && !req.context.get(SKIP_UNAUTHORIZED_HANDLING)) {
        auth.handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
