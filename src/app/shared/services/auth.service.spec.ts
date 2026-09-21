import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, describeFirebaseError, isFirebaseConfigured } from './auth.service';

const realConfig = {
  apiKey: 'AIzaSyReal',
  authDomain: 'charmeetchic.firebaseapp.com',
  projectId: 'charmeetchic',
  storageBucket: 'charmeetchic.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc',
};

describe('isFirebaseConfigured', () => {
  it('acepta una configuración completa', () => {
    expect(isFirebaseConfigured(realConfig)).toBe(true);
  });

  it('rechaza los marcadores "REEMPLAZAR-…" y los valores vacíos', () => {
    expect(isFirebaseConfigured({ ...realConfig, apiKey: 'REEMPLAZAR-api-key' })).toBe(false);
    expect(isFirebaseConfigured({ ...realConfig, appId: 'reemplazar-app-id' })).toBe(false);
    expect(isFirebaseConfigured({ ...realConfig, projectId: '' })).toBe(false);
  });

});

describe('describeFirebaseError', () => {
  const err = (code: string) => ({ code, message: 'Firebase: Error' });

  it('no informa cuando el usuario cierra el popup o lanza otro intento', () => {
    expect(describeFirebaseError(err('auth/popup-closed-by-user'))).toBeNull();
    expect(describeFirebaseError(err('auth/cancelled-popup-request'))).toBeNull();
  });

  it('traduce los errores de configuración más comunes', () => {
    expect(describeFirebaseError(err('auth/popup-blocked'))).toContain('bloqueó');
    expect(describeFirebaseError(err('auth/unauthorized-domain'))).toContain('Authorized domains');
    expect(describeFirebaseError(err('auth/operation-not-allowed'))).toContain(
      'no está habilitado',
    );
    expect(describeFirebaseError(err('auth/invalid-api-key'))).toContain('apiKey');
    expect(describeFirebaseError(err('auth/network-request-failed'))).toContain('conexión');
  });

  it('usa un mensaje genérico ante códigos desconocidos o errores sin código', () => {
    expect(describeFirebaseError(err('auth/otra-cosa'))).toContain('No se pudo iniciar sesión');
    expect(describeFirebaseError(new Error('boom'))).toContain('No se pudo iniciar sesión');
  });
});

describe('AuthService (sesión de desarrollo)', () => {
  let auth: AuthService;
  const originalBypass = environment.devAuthBypass;

  beforeEach(() => {
    // El servicio lee el flag al construirse; así el test no depende de cómo esté el environment.ts local.
    environment.devAuthBypass = true;
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideRouter([{ path: 'login', children: [] }])],
    });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    environment.devAuthBypass = originalBypass;
  });

  it('parte sin sesión y no es administrador', () => {
    expect(auth.isDevSession()).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.getUser()).toBeNull();
  });

  it('login simulado deja una sesión de administrador, sin tocar Firebase', async () => {
    await auth.login();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(auth.getUser()?.roles).toContain(environment.adminRole);
  });

  it('la sesión simulada se restaura al recargar y se borra al salir', async () => {
    await auth.login();
    const reloaded = TestBed.runInInjectionContext(() => new AuthService());
    await reloaded.initialize();
    expect(reloaded.isAuthenticated()).toBe(true);

    await auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
    const afterLogout = TestBed.runInInjectionContext(() => new AuthService());
    await afterLogout.initialize();
    expect(afterLogout.isAuthenticated()).toBe(false);
  });

  it('no hay token real que enviar al backend', async () => {
    expect(await firstValueFrom(auth.getToken())).toBeNull();
  });
});
