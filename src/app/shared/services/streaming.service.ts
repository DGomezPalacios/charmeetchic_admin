import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, exhaustMap, map, of, timeout, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_NOTIFICATION } from '../interceptors/http-context';
import { MetricsUpdate, StreamingMetrics } from '../models/streaming.model';

/** Cada cuánto se piden las métricas. */
export const STREAMING_POLL_MS = 2000;
/** Una petición más lenta que esto cuenta como fallo (si no, un backend colgado frenaría el sondeo). */
export const STREAMING_TIMEOUT_MS = 8000;

/**
 * Métricas en tiempo real (calculadas por el backend desde Kafka). Hay dos implementaciones:
 * `HttpStreamingService` (backend real) y `MockStreamingService` (datos de ejemplo); la elige
 * `provideStreaming()` según `environment.streamingMock`.
 */
export abstract class StreamingService {
  abstract getMetrics(): Observable<StreamingMetrics>;

  /** Pide al backend publicar `ventas` ventas simuladas en Kafka (para la demo). */
  abstract simulate(ventas: number): Observable<unknown>;

  /**
   * Sondea las métricas: una petición al suscribirse y luego cada `periodMs`. Un fallo se emite como
   * `{ ok: false }` y el sondeo continúa; se detiene al desuscribirse. Con `exhaustMap` no se apilan
   * peticiones: si una tarda más que el periodo, se salta ese ciclo en vez de cancelarla.
   */
  poll(periodMs = STREAMING_POLL_MS, timeoutMs = STREAMING_TIMEOUT_MS): Observable<MetricsUpdate> {
    return timer(0, periodMs).pipe(
      exhaustMap(() =>
        this.getMetrics().pipe(
          timeout(timeoutMs),
          map((metrics): MetricsUpdate => ({ ok: true, metrics })),
          catchError((error: unknown) => of<MetricsUpdate>({ ok: false, error })),
        ),
      ),
    );
  }
}

/** Implementación contra el backend: `GET /streaming/metrics` y `POST /streaming/simulate`. */
@Injectable()
export class HttpStreamingService extends StreamingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/streaming`;

  getMetrics(): Observable<StreamingMetrics> {
    // Sin snackbar por error: la página muestra su propio estado "sin conexión".
    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    return this.http
      .get<Partial<StreamingMetrics>>(`${this.baseUrl}/metrics`, { context })
      .pipe(map(normalizeMetrics));
  }

  simulate(ventas: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/simulate`, null, { params: { ventas } });
  }
}

/** Tolera campos ausentes o nulos (el endpoint es nuevo): números a 0 y listas vacías. */
export function normalizeMetrics(raw: Partial<StreamingMetrics> | null): StreamingMetrics {
  const r = raw ?? {};
  return {
    generadoEn: r.generadoEn ?? new Date().toISOString(),
    ventasUltimoMinuto: Number(r.ventasUltimoMinuto ?? 0),
    ventasTotales: Number(r.ventasTotales ?? 0),
    ingresosTotales: Number(r.ingresosTotales ?? 0),
    topProductos: r.topProductos ?? [],
    stockCritico: r.stockCritico ?? [],
    ultimosEventos: r.ultimosEventos ?? [],
  };
}
