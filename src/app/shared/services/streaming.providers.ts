import { Provider, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MockStreamingService } from './streaming-mock.service';
import { HttpStreamingService, StreamingService } from './streaming.service';

/** Datos de ejemplo solo si el flag está activo y no es un build de producción. */
export const useStreamingMock = (): boolean => environment.streamingMock && !environment.production;

/**
 * Elige la implementación de `StreamingService`. Se registra en la ruta "Tiempo real", así la
 * instancia (y el estado del simulador) vive mientras se navega por el panel.
 */
export function provideStreaming(): Provider[] {
  return [
    HttpStreamingService,
    MockStreamingService,
    {
      provide: StreamingService,
      // `inject` dentro del factory: solo se instancia la implementación elegida.
      useFactory: (): StreamingService =>
        useStreamingMock() ? inject(MockStreamingService) : inject(HttpStreamingService),
    },
  ];
}
