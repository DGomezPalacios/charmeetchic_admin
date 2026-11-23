import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MetricsUpdate, StreamingMetrics } from '../../../../shared/models/streaming.model';
import { NotificationService } from '../../../../shared/services/notification.service';
import { StreamingService } from '../../../../shared/services/streaming.service';
import { RealtimeDashboardComponent } from './realtime-dashboard.component';

registerLocaleData(localeEsCl, 'es-CL');

const metrics = (over: Partial<StreamingMetrics> = {}): StreamingMetrics => ({
  generadoEn: '2026-11-22T12:00:00Z',
  ventasUltimoMinuto: 7,
  ventasTotales: 1234,
  ingresosTotales: 2_590_000,
  topProductos: [
    { sku: 'A', nombre: 'Anillo Plata', unidades: 5 },
    { sku: 'B', nombre: 'Collar Perla', unidades: 10 },
    { sku: 'C', nombre: 'Pulsera', unidades: 3 },
    { sku: 'D', nombre: 'Reloj', unidades: 2 },
    { sku: 'E', nombre: 'Aros', unidades: 1 },
    { sku: 'F', nombre: 'Sexto', unidades: 1 },
  ],
  stockCritico: [
    { sku: 'S2', nombre: 'Cintillo', stock: 3 },
    { sku: 'S1', nombre: 'Estuche', stock: 0 },
  ],
  ultimosEventos: [
    {
      tipo: 'VENTA',
      detalle: '2 × Collar Perla',
      timestamp: '2026-11-22T12:00:00Z',
      particion: 2,
      offset: 9876,
    },
    {
      tipo: 'STOCK_CRITICO',
      detalle: 'Estuche: quedan 0 u.',
      timestamp: '2026-11-22T11:59:58Z',
      particion: 0,
      offset: 512,
    },
  ],
  ...over,
});

class FakeStreaming {
  readonly updates = new Subject<MetricsUpdate>();
  simulateResult: Observable<unknown> = of({ ventas: 20 });
  readonly simulate = vi.fn((_: number) => this.simulateResult);
  poll(): Observable<MetricsUpdate> {
    return this.updates;
  }
}

describe('RealtimeDashboardComponent', () => {
  let fixture: ComponentFixture<RealtimeDashboardComponent>;
  let fake: FakeStreaming;
  const notifications = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const push = async (update: MetricsUpdate) => {
    fake.updates.next(update);
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const dot = () => el().querySelector('.live .dot');

  beforeEach(async () => {
    notifications.success.mockReset();
    fake = new FakeStreaming();
    TestBed.configureTestingModule({
      imports: [RealtimeDashboardComponent],
      providers: [
        { provide: StreamingService, useValue: fake },
        { provide: NotificationService, useValue: notifications },
        { provide: LOCALE_ID, useValue: 'es-CL' },
      ],
    });
    fixture = TestBed.createComponent(RealtimeDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('mientras no llega nada muestra "Conectando…"', () => {
    expect(el().querySelector('.live')!.classList).toContain('live-connecting');
    expect(text()).toContain('Conectando con el flujo de eventos');
  });

  it('muestra los KPI, con los ingresos en CLP', async () => {
    await push({ ok: true, metrics: metrics() });
    const kpis = [...el().querySelectorAll('.kpi .value')].map((v) => v.textContent!.trim());
    expect(kpis[0]).toBe('7');
    expect(kpis[1]).toBe('1.234');
    expect(kpis[2]).toMatch(/^\$\s?2\.590\.000$/);
    expect(el().querySelector('.live')!.classList).toContain('live-live');
    expect(text()).toContain('En vivo');
  });

  it('top 5 ordenado de más a menos, con barras proporcionales al mayor', async () => {
    await push({ ok: true, metrics: metrics() });
    const names = [...el().querySelectorAll('.bars .name')].map((n) => n.textContent!.trim());
    expect(names).toEqual(['Collar Perla', 'Anillo Plata', 'Pulsera', 'Reloj', 'Aros']);
    const widths = [...el().querySelectorAll<HTMLElement>('.bar-fill')].map((b) => b.style.width);
    expect(widths).toEqual(['100%', '50%', '30%', '20%', '10%']);
  });

  it('stock crítico del más urgente al menos, resaltando los agotados', async () => {
    await push({ ok: true, metrics: metrics() });
    const items = el().querySelectorAll('.critical-item');
    expect(items[0].textContent).toContain('Estuche');
    expect(items[0].textContent).toContain('Agotado');
    expect(items[0].classList).toContain('out');
    expect(items[1].textContent).toContain('3 u.');
  });

  it('el feed muestra tipo, detalle, partición y offset de Kafka', async () => {
    await push({ ok: true, metrics: metrics() });
    const rows = el().querySelectorAll('.feed li');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent!.replace(/\s+/g, ' ')).toContain('P2 · offset 9876');
    expect(rows[0].querySelector('.chip')!.classList).toContain('ev-sale');
    expect(rows[1].querySelector('.chip')!.classList).toContain('ev-stock');
  });

  it('el indicador "en vivo" parpadea solo cuando llegan datos nuevos', async () => {
    await push({ ok: true, metrics: metrics() });
    const first = dot();

    // Misma información (solo cambia generadoEn): el punto no se vuelve a crear.
    await push({ ok: true, metrics: metrics({ generadoEn: '2026-11-22T12:00:02Z' }) });
    expect(dot()).toBe(first);

    // Una venta nueva: se recrea el punto y la animación vuelve a empezar.
    await push({ ok: true, metrics: metrics({ ventasTotales: 1235 }) });
    expect(dot()).not.toBe(first);
  });

  it('si el backend no responde y no hay datos, muestra un error claro', async () => {
    await push({ ok: false, error: new Error('timeout') });
    expect(el().querySelector('[role="alert"]')!.textContent).toContain(
      'El servicio de métricas no responde',
    );
    expect(text()).toContain('Sin conexión');
    expect(text()).toContain('Revisa que el backend esté en línea');
    expect(el().querySelector('.kpi')).toBeNull();
  });

  it('si se cae después, conserva los últimos datos y avisa; al volver, se recupera', async () => {
    await push({ ok: true, metrics: metrics() });
    await push({ ok: false, error: new Error('500') });
    expect(el().querySelector('[role="alert"]')!.textContent).toContain(
      'Se muestran los últimos datos recibidos',
    );
    expect(el().querySelectorAll('.kpi').length).toBe(3);

    await push({ ok: true, metrics: metrics() });
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain('En vivo');
  });

  it('"Simular 20 ventas" llama al servicio con 20 y confirma', async () => {
    await push({ ok: true, metrics: metrics() });
    const button = [...el().querySelectorAll('button')].find((b) =>
      b.textContent!.includes('Simular 20 ventas'),
    )!;
    button.click();
    fixture.detectChanges();
    expect(fake.simulate).toHaveBeenCalledWith(20);
    expect(notifications.success).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  });

  it('el botón se deshabilita mientras se envía y se rehabilita si falla', async () => {
    await push({ ok: true, metrics: metrics() });
    const pending = new Subject<unknown>();
    fake.simulateResult = pending;
    const button = el().querySelector<HTMLButtonElement>('.page-actions button')!;
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Enviando');

    pending.error(new Error('503'));
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('deja de sondear al salir de la página', () => {
    expect(fake.updates.observed).toBe(true);
    fixture.destroy();
    expect(fake.updates.observed).toBe(false);
  });

  it('un error inmediato al simular no rompe el componente', () => {
    fake.simulateResult = throwError(() => new Error('x'));
    expect(() =>
      el().querySelector<HTMLButtonElement>('.page-actions button')!.click(),
    ).not.toThrow();
  });
});
