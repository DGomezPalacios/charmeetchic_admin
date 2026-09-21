import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCl from '@angular/common/locales/es-CL';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { errorInterceptor } from './shared/interceptors/error.interceptor';
import { AuthService } from './shared/services/auth.service';
import { SpanishPaginatorIntl } from './shared/services/spanish-paginator-intl';

registerLocaleData(localeEsCl, environment.app.locale);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: environment.app.locale },
    { provide: MAT_DATE_LOCALE, useValue: environment.app.locale },
    { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl },
    // Firebase: solo Authentication. Las instancias se crean al usarlas (no en modo desarrollo simulado).
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      if (environment.authEmulatorUrl) {
        connectAuthEmulator(auth, environment.authEmulatorUrl, { disableWarnings: true });
      }
      return auth;
    }),
    // Restaura la sesión de Firebase antes de que el router evalúe los guards.
    provideAppInitializer(() => inject(AuthService).initialize()),
  ],
};
