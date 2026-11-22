import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EventoStreaming, StreamingMetrics } from '../../../../shared/models/streaming.model';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { NotificationService } from '../../../../shared/services/notification.service';
import { useStreamingMock } from '../../../../shared/services/streaming.providers';
import { STREAMING_POLL_MS, StreamingService } from '../../../../shared/services/streaming.service';

export type ConnectionStatus = 'connecting' | 'live' | 'error';

/** Ventas que publica el botón de la demo. */
export const SIMULATED_SALES = 20;

@Component({
  selector: 'app-realtime-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    LoadingSpinnerComponent,
    PricePipe,
  ],
  templateUrl: './realtime-dashboard.component.html',
  styleUrl: './realtime-dashboard.component.css',
})
export class RealtimeDashboardComponent {
  private readonly streaming = inject(StreamingService);
  private readonly notifications = inject(NotificationService);

  protected readonly pollSeconds = STREAMING_POLL_MS / 1000;
  protected readonly simulatedSales = SIMULATED_SALES;
  protected readonly demoData = useStreamingMock();

  protected readonly metrics = signal<StreamingMetrics | null>(null);
  protected readonly status = signal<ConnectionStatus>('connecting');
  /** Hora (del navegador) de la última respuesta correcta. */
  protected readonly lastUpdate = signal<Date | null>(null);
  /** Cambia cada vez que llegan datos nuevos; reinicia la animación del indicador "en vivo". */
  protected readonly pulse = signal(0);
  protected readonly simulating = signal(false);

  protected readonly topProducts = computed(() =>
    [...(this.metrics()?.topProductos ?? [])].sort((a, b) => b.unidades - a.unidades).slice(0, 5),
  );
  protected readonly topMax = computed(() =>
    Math.max(1, ...this.topProducts().map((p) => p.unidades)),
  );
  protected readonly criticalStock = computed(() =>
    [...(this.metrics()?.stockCritico ?? [])].sort((a, b) => a.stock - b.stock),
  );

  private fingerprint = '';

  constructor() {
    // takeUntilDestroyed: el sondeo se detiene al salir de la página.
    this.streaming
      .poll()
      .pipe(takeUntilDestroyed())
      .subscribe((update) => {
        if (!update.ok) {
          this.status.set('error');
          return;
        }
        this.metrics.set(update.metrics);
        this.status.set('live');
        this.lastUpdate.set(new Date());

        const fingerprint = fingerprintOf(update.metrics);
        if (fingerprint !== this.fingerprint) {
          this.fingerprint = fingerprint;
          this.pulse.update((n) => n + 1);
        }
      });
  }

  protected simulate(): void {
    this.simulating.set(true);
    this.streaming
      .simulate(SIMULATED_SALES)
      .pipe(finalize(() => this.simulating.set(false)))
      .subscribe({
        next: () =>
          this.notifications.success(
            `Se publicaron ${SIMULATED_SALES} ventas simuladas. Aparecerán en unos segundos.`,
          ),
        // El interceptor de errores ya muestra el mensaje del backend.
        error: () => undefined,
      });
  }

  protected barWidth(unidades: number): number {
    return Math.round((unidades / this.topMax()) * 100);
  }

  protected eventKind(tipo: string): 'sale' | 'stock' | 'other' {
    const t = tipo.toUpperCase();
    if (t.includes('VENTA') || t.includes('SALE') || t.includes('ORDER')) return 'sale';
    if (t.includes('STOCK')) return 'stock';
    return 'other';
  }

  protected eventIcon(tipo: string): string {
    return { sale: 'shopping_bag', stock: 'inventory', other: 'bolt' }[this.eventKind(tipo)];
  }

  protected eventLabel(tipo: string): string {
    return tipo.replace(/_/g, ' ').toLowerCase();
  }

  protected trackEvent(event: EventoStreaming): string {
    return `${event.particion}:${event.offset}`;
  }
}

/** Identifica el contenido: si no cambia, no hay datos nuevos (aunque `generadoEn` sí cambie). */
function fingerprintOf(m: StreamingMetrics): string {
  const last = m.ultimosEventos[0];
  return `${m.ventasTotales}|${m.ingresosTotales}|${last ? `${last.particion}:${last.offset}` : '-'}`;
}
