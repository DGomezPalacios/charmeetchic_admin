import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError } from './http-error';

const err = (status: number, body?: unknown) => new HttpErrorResponse({ status, error: body });

describe('describeHttpError', () => {
  it('usa el mensaje del ApiError del backend cuando existe', () => {
    expect(describeHttpError(err(409, { message: "Ya existe un producto con SKU 'X'" }))).toBe(
      "Ya existe un producto con SKU 'X'",
    );
  });

  it('agrega el detalle por campo de los errores de validación', () => {
    const message = describeHttpError(
      err(400, {
        message: 'Datos de entrada inválidos',
        fieldErrors: { price: 'El precio debe ser mayor que 0', sku: 'El SKU es obligatorio' },
      }),
    );
    expect(message).toBe(
      'Datos de entrada inválidos (price: El precio debe ser mayor que 0; sku: El SKU es obligatorio)',
    );
  });

  it('no filtra detalles del servidor en errores 5xx', () => {
    expect(
      describeHttpError(err(500, { message: 'NullPointerException en Foo.java:12' })),
    ).not.toContain('NullPointer');
  });

  it('cubre falta de conexión, sesión y permisos', () => {
    expect(describeHttpError(err(0))).toContain('No se pudo conectar');
    expect(describeHttpError(err(401))).toContain('sesión expiró');
    expect(describeHttpError(err(403))).toContain('permisos');
  });

  it('tolera cuerpos que no son JSON', () => {
    expect(describeHttpError(err(404, '<html>Not found</html>'))).toBe(
      'No se encontró el recurso solicitado.',
    );
  });
});
