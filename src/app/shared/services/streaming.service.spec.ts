import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { SKIP_ERROR_NOTIFICATION } from '../interceptors/http-context';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { MetricsUpdate, StreamingMetrics } from '../models/streaming.model';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { MockStreamingService } from './streaming-mock.service';
import { HttpStreamingService, StreamingService, normalizeMetrics } from './streaming.service';

const METRICS: StreamingMetrics = {
  generadoEn: '2026-11-22T12:00:00Z',
  ventasUltimoMinuto: 3,
  ventasTotales: 120,
  ingresosTotales: 1_500_000,
  topProductos: [{ sku: 'COL-0001', nombre: 'Collar', unidades: 9 }],
  stockCritico: [{ sku: 'ANI-0002', nombre: 'Anillo', stock: 1 }],
  ultimosEventos: [
    {
      tipo: 'VENTA',
      detalle: '1 × Collar',
      timestamp: '2026-11-22T12:00:00Z',
      particion: 1,
      offset: 42,
    },
  ],
};

describe('HttpStreamingService', () => {
  let service: HttpStreamingService;
  let http: HttpTestingController;
  const notifications = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    notifications.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        HttpStreamingService,
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: { isDevSession: () => false } },
      ],
    });
    service = TestBed.inject(HttpStreamingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET {apiUrl}/streaming/metrics sin snackbar de error', async () => {
    const result = firstValueFrom(service.getMetrics());
    const req = http.expectOne(`${environment.apiUrl}/streaming/metrics`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    req.flush(METRICS);
    expect(await result).toEqual(METRICS);
  });

  it('un 500 del sondeo no muestra snackbar (la página tiene su propio estado de error)', async () => {
    const result = firstValueFrom(service.getMetrics());
    http
      .expectOne(`${environment.apiUrl}/streaming/metrics`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('completa campos ausentes con 0 y listas vacías', async () => {
    const result = firstValueFrom(service.getMetrics());
    http
      .expectOne(`${environment.apiUrl}/streaming/metrics`)
      .flush({ generadoEn: 'x', ventasTotales: 5 });
    expect(await result).toEqual({
      generadoEn: 'x',
      ventasUltimoMinuto: 0,
      ventasTotales: 5,
      ingresosTotales: 0,
      topProductos: [],
      stockCritico: [],
      ultimosEventos: [],
    });
  });

  it('simula ventas con POST {apiUrl}/streaming/simulate?ventas=20 (y sí avisa si falla)', async () => {
    const result = firstValueFrom(service.simulate(20));
    const req = http.expectOne(`${environment.apiUrl}/streaming/simulate?ventas=20`);
    expect(req.request.method).toBe('POST');
    req.flush('no', { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(notifications.error).toHaveBeenCalledTimes(1);
  });

  it('normalizeMetrics acepta null', () => {
    expect(normalizeMetrics(null).ultimosEventos).toEqual([]);
  });
});

/** Implementación controlable para probar `poll()`. */
class FakeStreaming extends StreamingService {
  responses: (() => Observable<StreamingMetrics>)[] = [];
  calls = 0;
  getMetrics(): Observable<StreamingMetrics> {
    const next = this.responses[this.calls++] ?? (() => of(METRICS));
    return next();
  }
  simulate(): Observable<unknown> {
    return of(null);
  }
}

describe('StreamingService.poll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('consulta al suscribirse y luego cada 2 s; se detiene al desuscribirse', () => {
    const fake = new FakeStreaming();
    const updates: MetricsUpdate[] = [];
    const sub = fake.poll(2000).subscribe((u) => updates.push(u));

    vi.advanceTimersByTime(0);
    expect(fake.calls).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(fake.calls).toBe(2);
    vi.advanceTimersByTime(4000);
    expect(fake.calls).toBe(4);
    expect(updates.every((u) => u.ok)).toBe(true);

    sub.unsubscribe();
    vi.advanceTimersByTime(10_000);
    expect(fake.calls).toBe(4);
  });

  it('un error no corta el sondeo: emite { ok: false } y el siguiente ciclo se recupera', () => {
    const fake = new FakeStreaming();
    fake.responses = [() => throwError(() => new Error('caído')), () => of(METRICS)];
    const updates: MetricsUpdate[] = [];
    const sub = fake.poll(2000).subscribe((u) => updates.push(u));

    vi.advanceTimersByTime(2000);
    expect(updates.map((u) => u.ok)).toEqual([false, true]);
    sub.unsubscribe();
  });

  it('no apila peticiones lentas y corta las colgadas por timeout', () => {
    const fake = new FakeStreaming();
    const hanging = new Subject<StreamingMetrics>();
    fake.responses = [() => hanging];
    const updates: MetricsUpdate[] = [];
    const sub = fake.poll(2000, 5000).subscribe((u) => updates.push(u));

    vi.advanceTimersByTime(4000);
    expect(fake.calls).toBe(1); // los ciclos de 2 s y 4 s se saltan
    vi.advanceTimersByTime(1000);
    expect(updates).toEqual([{ ok: false, error: expect.anything() }]);
    vi.advanceTimersByTime(1000);
    expect(fake.calls).toBe(2);
    sub.unsubscribe();
  });
});

describe('MockStreamingService', () => {
  let mock: MockStreamingService;

  beforeEach(() => {
    mock = new MockStreamingService();
    mock.latencyMs = 0;
    mock.autoTraffic = false;
  });

  it('arranca con historial para que la página no esté vacía', async () => {
    const m = await firstValueFrom(mock.getMetrics());
    expect(m.ventasTotales).toBeGreaterThan(0);
    expect(m.ultimosEventos.length).toBeGreaterThan(0);
  });

  it('simulate(20) suma 20 ventas, también en el último minuto, e ingresos', async () => {
    const before = await firstValueFrom(mock.getMetrics());
    await firstValueFrom(mock.simulate(20));
    const after = await firstValueFrom(mock.getMetrics());
    expect(after.ventasTotales).toBe(before.ventasTotales + 20);
    expect(after.ventasUltimoMinuto).toBe(before.ventasUltimoMinuto + 20);
    expect(after.ingresosTotales).toBeGreaterThan(before.ingresosTotales);
  });

  it('las ventas de hace más de un minuto salen de la ventana', async () => {
    const t0 = Date.now();
    mock.now = () => t0;
    await firstValueFrom(mock.simulate(5));
    mock.now = () => t0 + 61_000;
    expect((await firstValueFrom(mock.getMetrics())).ventasUltimoMinuto).toBe(0);
  });

  it('top: máximo 5, de más a menos unidades; stock crítico: bajo el umbral, del menor al mayor', async () => {
    await firstValueFrom(mock.simulate(50));
    const m = await firstValueFrom(mock.getMetrics());
    const units = m.topProductos.map((p) => p.unidades);
    expect(units.length).toBeLessThanOrEqual(5);
    expect(units).toEqual([...units].sort((a, b) => b - a));
    expect(m.stockCritico.every((p) => p.stock < LOW_STOCK_THRESHOLD && p.stock >= 0)).toBe(true);
    const stock = m.stockCritico.map((p) => p.stock);
    expect(stock).toEqual([...stock].sort((a, b) => a - b));
  });

  it('eventos: el más reciente primero, máximo 15, offsets crecientes por partición', async () => {
    await firstValueFrom(mock.simulate(20));
    const events = (await firstValueFrom(mock.getMetrics())).ultimosEventos;
    expect(events.length).toBe(15);
    for (const p of [0, 1, 2]) {
      const offsets = events.filter((e) => e.particion === p).map((e) => e.offset);
      expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
      expect(new Set(offsets).size).toBe(offsets.length);
    }
    expect(events.every((e) => e.particion >= 0 && e.particion < 3)).toBe(true);
  });

  it('con autoTraffic genera ventas espontáneas en cada consulta', async () => {
    mock.autoTraffic = true;
    mock.random = () => 0.99; // 2 ventas por consulta
    const before = (await firstValueFrom(mock.getMetrics())).ventasTotales;
    const after = (await firstValueFrom(mock.getMetrics())).ventasTotales;
    expect(after - before).toBe(2);
  });
});
