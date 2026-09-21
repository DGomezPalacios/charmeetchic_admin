import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, inject, runInInjectionContext, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, from, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_UNAUTHORIZED_HANDLING } from '../interceptors/http-context';
import { ApiError } from '../models/api-error';
import { AuthUser } from '../models/user.model';
import { ProfileResponse } from './api-mappers';

const DEV_SESSION_KEY = 'cce.devSession';

const DEV_USER: AuthUser = {
  id: 'dev-admin',
  name: 'Admin Desarrollo',
  email: 'admin@charmeetchic.local',
  roles: [environment.adminRole],
};

/** `true` si `environment.firebase` ya tiene valores reales y no los marcadores "REEMPLAZAR-…". */
export function isFirebaseConfigured(config = environment.firebase): boolean {
  return Object.values(config).every((value) => !!value && !/^REEMPLAZAR/i.test(value));
}

/**
 * Autenticación con Firebase (Google Sign-In) y sesión del administrador expuesta como signals.
 *
 * Firebase solo dice *quién* es el usuario. Si es administrador lo decide el backend según los
 * custom claims del ID token, y lo informa `GET /profile`; hasta confirmarlo, el usuario no tiene rol.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  /** Sesión simulada: nunca en producción, aunque el flag esté activo. */
  private readonly devBypass = environment.devAuthBypass && !environment.production;

  private readonly currentUser = signal<AuthUser | null>(null);
  private readonly error = signal<string | null>(null);
  private redirectingToLogin = false;
  private syncing: { uid: string | null; promise: Promise<void> } | null = null;

  readonly user = this.currentUser.asReadonly();
  /** Último error de autenticación (p. ej. no se pudo verificar el rol), para mostrarlo en el login. */
  readonly authError = this.error.asReadonly();

  /** `Auth` se resuelve solo si se usa Firebase, así el modo desarrollo no lo inicializa. */
  private get auth(): Auth {
    return this.injector.get(Auth);
  }

  /**
   * AngularFire exige llamar a sus funciones dentro de un contexto de inyección (si no, advierte de
   * posibles bugs de detección de cambios). Tras un `await` ese contexto ya no existe: se restaura aquí.
   */
  private inContext<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  isDevSession(): boolean {
    return this.devBypass;
  }

  /** Se ejecuta antes de que arranque la app: restaura la sesión de Firebase (si hay una guardada). */
  async initialize(): Promise<void> {
    if (this.devBypass) {
      if (this.readDevSession()) {
        this.currentUser.set(DEV_USER);
      }
      return;
    }
    if (!isFirebaseConfigured()) {
      this.error.set(
        'Firebase no está configurado: completa `firebase` en src/environments/environment.ts.',
      );
      return;
    }

    try {
      const auth = this.auth;
      await new Promise<void>((resolve) => {
        let first = true;
        // Mantiene la sesión al día si cambia fuera del flujo (otra pestaña, token revocado…).
        this.inContext(() =>
          onAuthStateChanged(auth, (user) => {
            void this.sync(user).finally(() => {
              if (first) {
                first = false;
                resolve();
              }
            });
          }),
        );
      });
    } catch (error) {
      console.error('[Auth] Error al inicializar Firebase', error);
      this.error.set(
        'No se pudo inicializar Firebase. Revisa la configuración e inténtalo de nuevo.',
      );
    }
  }

  /** Abre el popup de Google. Resuelve cuando la sesión y el rol ya están cargados. */
  async login(): Promise<void> {
    this.error.set(null);
    if (this.devBypass) {
      this.writeDevSession(true);
      this.currentUser.set(DEV_USER);
      return;
    }
    if (!isFirebaseConfigured()) {
      this.error.set(
        'Firebase no está configurado: completa `firebase` en src/environments/environment.ts.',
      );
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await this.inContext(() => signInWithPopup(this.auth, provider));
      await this.sync(credential.user);
    } catch (error) {
      const message = describeFirebaseError(error);
      if (message) {
        this.error.set(message);
      }
      if (!isPopupDismissed(error)) {
        console.error('[Auth] Error al iniciar sesión', error);
      }
    }
  }

  async logout(): Promise<void> {
    this.currentUser.set(null);
    if (this.devBypass) {
      this.writeDevSession(false);
    } else {
      await this.inContext(() => signOut(this.auth));
    }
    await this.router.navigateByUrl('/login');
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  isAdmin(): boolean {
    return this.currentUser()?.roles.includes(environment.adminRole) ?? false;
  }

  getUser(): AuthUser | null {
    return this.currentUser();
  }

  /**
   * ID token (JWT) de Firebase para el backend. `getIdToken()` lo renueva solo cuando está por vencer
   * (dura 1 hora). Emite `null` en la sesión de desarrollo, que no tiene token real.
   */
  getToken(): Observable<string | null> {
    if (this.devBypass) {
      return of(null);
    }
    const user = this.auth.currentUser;
    if (!user) {
      return throwError(() => new ApiError('No hay una sesión activa.', 401));
    }
    return from(user.getIdToken()).pipe(
      catchError((error: unknown) => {
        console.error('[Auth] No se pudo obtener el token de Firebase', error);
        return throwError(() => new ApiError('Tu sesión expiró. Inicia sesión nuevamente.', 401));
      }),
    );
  }

  /** El backend respondió 401 con un token válido para Firebase: se cierra la sesión y se vuelve al login. */
  handleUnauthorized(): void {
    if (this.devBypass || this.redirectingToLogin) {
      return;
    }
    this.redirectingToLogin = true;
    this.currentUser.set(null);
    void this.inContext(() => signOut(this.auth))
      .catch(() => undefined)
      .then(() => this.router.navigate(['/login'], { queryParams: { reason: 'expired' } }))
      .finally(() => (this.redirectingToLogin = false));
  }

  /**
   * Sincroniza la sesión con el usuario de Firebase. Si ya hay una sincronización en curso para el mismo
   * usuario (p. ej. `signInWithPopup` y `onAuthStateChanged` disparan casi a la vez) reutiliza esa.
   */
  private sync(user: User | null): Promise<void> {
    const uid = user?.uid ?? null;
    // Ya cargado (p. ej. el listener llega después de que `login()` terminó): no se repite la consulta.
    if (uid && this.currentUser()?.id === uid) {
      return Promise.resolve();
    }
    if (this.syncing && this.syncing.uid === uid) {
      return this.syncing.promise;
    }
    const promise = this.applyUser(user).finally(() => {
      if (this.syncing?.promise === promise) {
        this.syncing = null;
      }
    });
    this.syncing = { uid, promise };
    return promise;
  }

  private async applyUser(user: User | null): Promise<void> {
    if (!user) {
      this.currentUser.set(null);
      return;
    }
    const base: AuthUser = {
      id: user.uid,
      name: user.displayName || user.email || 'Usuario',
      email: user.email ?? '',
      photoUrl: user.photoURL ?? undefined,
      roles: [],
    };
    try {
      const profile = await firstValueFrom(
        this.http.get<ProfileResponse>(`${environment.apiUrl}/profile`, {
          context: new HttpContext().set(SKIP_UNAUTHORIZED_HANDLING, true),
        }),
      );
      this.currentUser.set({
        ...base,
        name: profile.name || base.name,
        email: profile.email || base.email,
        roles: profile.roles,
      });
    } catch (error) {
      console.error('[Auth] No se pudo obtener el perfil desde el backend', error);
      this.error.set(describeProfileError(error));
      // Autenticado en Firebase, pero sin rol confirmado: no podrá entrar al panel.
      this.currentUser.set(base);
    }
  }

  private readDevSession(): boolean {
    try {
      return sessionStorage.getItem(DEV_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  private writeDevSession(active: boolean): void {
    try {
      if (active) {
        sessionStorage.setItem(DEV_SESSION_KEY, '1');
      } else {
        sessionStorage.removeItem(DEV_SESSION_KEY);
      }
    } catch {
      // Sin sessionStorage la sesión simulada dura hasta recargar la página.
    }
  }
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

/** El usuario cerró el popup o lanzó otro: no es un error que haya que mostrar. */
function isPopupDismissed(error: unknown): boolean {
  return ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(errorCode(error));
}

/** Mensaje en español para un error de Firebase Auth; `null` si no hay nada que informar. */
export function describeFirebaseError(error: unknown): string | null {
  switch (errorCode(error)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.';
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con Google no está habilitado en Firebase (Authentication → Sign-in method).';
    case 'auth/network-request-failed':
      return 'No se pudo conectar con Firebase. Revisa tu conexión.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'La apiKey de Firebase no es válida. Revisa `firebase` en environment.ts.';
    case 'auth/user-disabled':
      return 'Tu cuenta está deshabilitada en Firebase.';
    default:
      return 'No se pudo iniciar sesión con Google. Inténtalo nuevamente.';
  }
}

function describeProfileError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Iniciaste sesión, pero no se pudo conectar con el servidor para verificar tu rol.';
    }
    if (error.status === 401) {
      return `El servidor rechazó tu token de Firebase. Verifica que el backend use el mismo proyecto (${environment.firebase.projectId}).`;
    }
  }
  return 'Iniciaste sesión, pero no se pudo verificar tu rol de administrador con el servidor.';
}
