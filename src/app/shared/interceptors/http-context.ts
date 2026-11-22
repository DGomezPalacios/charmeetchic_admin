import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición cuyo 401 no debe cerrar la sesión: la maneja quien la hace.
 * Se usa al pedir `GET /profile` justo tras iniciar sesión: un 401 ahí significa que el backend no
 * acepta el token (proyecto de Firebase distinto), no que la sesión expiró.
 */
export const SKIP_UNAUTHORIZED_HANDLING = new HttpContextToken<boolean>(() => false);

/**
 * Marca una petición cuyo error no debe mostrarse como snackbar: quien la hace lo presenta en su propia
 * UI. Se usa en el sondeo de métricas en tiempo real, que fallaría cada 2 s si el backend se cae.
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);
