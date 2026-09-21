import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { describeHttpError } from '../services/http-error';
import { NotificationService } from '../services/notification.service';

/** Registra los errores HTTP y muestra un mensaje amigable al usuario. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      // Con respaldo demo, ApiService pasa a datos de ejemplo y lo avisa con un banner.
      const fallsBackToDemo = environment.mockFallback && error.status === 0;
      const log = fallsBackToDemo ? console.warn : console.error;
      log(`[HTTP ${error.status}] ${req.method} ${req.urlWithParams}`, error);

      // En sesión real, un 401 lo gestiona authInterceptor (redirige al login).
      if (error.status === 401 && auth.isDevSession() && !environment.mockFallback) {
        notifications.error(
          'El backend rechazó la sesión de desarrollo (401). Configura Firebase y desactiva devAuthBypass.',
        );
      } else if (error.status !== 401 && !fallsBackToDemo) {
        notifications.error(describeHttpError(error));
      }
      return throwError(() => error);
    }),
  );
};
