import { Injectable } from '@angular/core';
import { Observable, defer, delay, of } from 'rxjs';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { EventoStreaming, StreamingMetrics } from '../models/streaming.model';
import { buildMockProducts } from './mock-data';
import { StreamingService } from './streaming.service';

const PARTITIONS = 3;
const MAX_EVENTS = 15;
const MINUTE_MS = 60_000;
const RESTOCK_UNITS = 12;

interface MockProduct {
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  vendidas: number;
}

/**
 * Simula en memoria lo que el backend calculará desde Kafka, para ver la página sin backend
 * (`environment.streamingMock`). Cada consulta puede traer ventas nuevas (`autoTraffic`), como si
 * llegaran clientes; la partición se elige por la clave del evento (el SKU), igual que en Kafka.
 */
@Injectable()
export class MockStreamingService extends StreamingService {
  /** Latencia simulada de cada respuesta. */
  latencyMs = 150;
  /** Genera ventas espontáneas en cada consulta. Los tests lo apagan para tener resultados exactos. */
  autoTraffic = true;
  random: () => number = Math.random;
  now: () => number = Date.now;

  private readonly products: MockProduct[] = buildMockProducts().map((p) => ({
    sku: p.sku,
    nombre: p.name,
    precio: p.price,
    stock: p.stock,
    vendidas: 0,
  }));
  private readonly offsets = [1_204, 1_187, 1_221];
  private readonly saleTimes: number[] = [];
  private readonly events: EventoStreaming[] = [];
  private totalSales = 0;
  private revenue = 0;

  constructor() {
    super();
    // Historial previo, para que la página no arranque vacía.
    const start = this.now();
    for (let i = 0; i < 30; i++) {
      this.sell(start - (30 - i) * 7_000);
    }
  }

  getMetrics(): Observable<StreamingMetrics> {
    return defer(() => {
      if (this.autoTraffic) {
        const arrivals = Math.floor(this.random() * 3); // 0, 1 o 2 ventas por consulta
        for (let i = 0; i < arrivals; i++) this.sell(this.now());
      }
      return of(this.snapshot());
    }).pipe(delay(this.latencyMs));
  }

  simulate(ventas: number): Observable<{ ventas: number }> {
    return defer(() => {
      for (let i = 0; i < ventas; i++) this.sell(this.now());
      return of({ ventas });
    }).pipe(delay(this.latencyMs));
  }

  private sell(at: number): void {
    const product = this.products[Math.floor(this.random() * this.products.length)];
    const units = 1 + Math.floor(this.random() * 3);

    if (product.stock < units) {
      product.stock += RESTOCK_UNITS;
      this.publish('STOCK_REPUESTO', `${product.nombre}: +${RESTOCK_UNITS} u.`, product.sku, at);
    }
    product.stock -= units;
    product.vendidas += units;
    this.totalSales++;
    this.revenue += units * product.precio;
    this.saleTimes.push(at);
    this.publish('VENTA', `${units} × ${product.nombre} (${product.sku})`, product.sku, at);

    if (product.stock < LOW_STOCK_THRESHOLD) {
      this.publish(
        'STOCK_CRITICO',
        `${product.nombre}: quedan ${product.stock} u.`,
        product.sku,
        at,
      );
    }
  }

  private publish(tipo: string, detalle: string, key: string, at: number): void {
    const particion = partitionFor(key);
    const offset = this.offsets[particion]++;
    this.events.unshift({
      tipo,
      detalle,
      timestamp: new Date(at).toISOString(),
      particion,
      offset,
    });
    this.events.length = Math.min(this.events.length, MAX_EVENTS);
  }

  private snapshot(): StreamingMetrics {
    const now = this.now();
    return {
      generadoEn: new Date(now).toISOString(),
      ventasUltimoMinuto: this.saleTimes.filter((t) => t > now - MINUTE_MS).length,
      ventasTotales: this.totalSales,
      ingresosTotales: this.revenue,
      topProductos: this.products
        .filter((p) => p.vendidas > 0)
        .sort((a, b) => b.vendidas - a.vendidas)
        .slice(0, 5)
        .map(({ sku, nombre, vendidas }) => ({ sku, nombre, unidades: vendidas })),
      stockCritico: this.products
        .filter((p) => p.stock < LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.stock - b.stock)
        .map(({ sku, nombre, stock }) => ({ sku, nombre, stock })),
      ultimosEventos: this.events.map((e) => ({ ...e })),
    };
  }
}

/** Partición por hash de la clave, como el particionador por defecto de Kafka (simplificado). */
function partitionFor(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % PARTITIONS;
}
