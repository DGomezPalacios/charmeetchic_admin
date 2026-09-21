import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición cuyo 401 no debe cerrar la sesión: la maneja quien la hace.
 * Se usa al pedir `GET /profile` justo tras iniciar sesión: un 401 ahí significa que el backend no
 * acepta el token (proyecto de Firebase distinto), no que la sesión expiró.
 */
export const SKIP_UNAUTHORIZED_HANDLING = new HttpContextToken<boolean>(() => false);
