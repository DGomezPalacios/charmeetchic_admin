import { HttpErrorResponse } from '@angular/common/http';

/**
 * Traduce un error HTTP a un mensaje entendible para el usuario.
 * Usa el `message` del backend (`ApiError`) y, en errores de validación, el detalle por campo.
 */
export function describeHttpError(error: HttpErrorResponse): string {
  const serverMessage = extractServerMessage(error);
  switch (true) {
    case error.status === 0:
      return 'No se pudo conectar con el servidor. Revisa tu conexión o intenta más tarde.';
    case error.status === 400 || error.status === 422:
      return serverMessage ?? 'Los datos enviados no son válidos.';
    case error.status === 401:
      return 'Tu sesión expiró. Inicia sesión nuevamente.';
    case error.status === 403:
      return 'No tienes permisos para realizar esta acción.';
    case error.status === 404:
      return serverMessage ?? 'No se encontró el recurso solicitado.';
    case error.status === 409:
      return serverMessage ?? 'La operación entra en conflicto con datos existentes.';
    case error.status >= 500:
      return 'Ocurrió un error en el servidor. Intenta nuevamente en unos minutos.';
    default:
      return serverMessage ?? 'Ocurrió un error inesperado.';
  }
}

function extractServerMessage(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  if (!body || typeof body !== 'object') {
    return null;
  }
  const { message, fieldErrors } = body as { message?: unknown; fieldErrors?: unknown };
  const base = typeof message === 'string' && message.trim() ? message : null;

  if (fieldErrors && typeof fieldErrors === 'object') {
    const details = Object.entries(fieldErrors as Record<string, unknown>)
      .filter(([, text]) => typeof text === 'string')
      .map(([field, text]) => `${field}: ${text}`);
    if (details.length > 0) {
      return base ? `${base} (${details.join('; ')})` : details.join('; ');
    }
  }
  return base;
}
