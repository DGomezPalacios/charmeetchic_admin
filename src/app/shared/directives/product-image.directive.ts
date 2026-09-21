import { Directive, input, linkedSignal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Marcador neutro (SVG embebido) para imágenes ausentes o que no cargan. */
export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
      '<rect width="80" height="80" fill="#e7e4da"/>' +
      '<path d="M40 22l14 14-14 22-14-22z" fill="none" stroke="#a67c00" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M26 36h28" stroke="#a67c00" stroke-width="3"/></svg>',
  );

/**
 * Las imágenes de producto pueden ser URLs absolutas, data URIs o rutas relativas al backend
 * (p. ej. `/images/products/anillo.jpg`). Estas últimas se resuelven contra el origen de la API.
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) {
    return IMAGE_PLACEHOLDER;
  }
  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }
  return url.startsWith('/') ? new URL(environment.apiUrl).origin + url : url;
}

/** `<img [appProductImage]="url">`: resuelve la URL y muestra un marcador si la imagen no carga. */
@Directive({
  selector: 'img[appProductImage]',
  host: {
    '[src]': 'src()',
    '(error)': 'failed.set(true)',
  },
})
export class ProductImageDirective {
  readonly appProductImage = input<string | null | undefined>();

  /** Se reinicia al cambiar la URL. */
  protected readonly failed = linkedSignal({
    source: this.appProductImage,
    computation: () => false,
  });

  protected readonly src = () =>
    this.failed() ? IMAGE_PLACEHOLDER : resolveImageUrl(this.appProductImage());
}
