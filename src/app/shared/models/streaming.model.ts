/**
 * Métricas en tiempo real que el backend calcula consumiendo los eventos de Kafka
 * (`GET {apiUrl}/streaming/metrics`).
 */
export interface StreamingMetrics {
  /** Momento en que el backend armó la respuesta (ISO-8601). */
  generadoEn: string;
  ventasUltimoMinuto: number;
  ventasTotales: number;
  /** En CLP. */
  ingresosTotales: number;
  topProductos: TopProductoStreaming[];
  stockCritico: StockCriticoStreaming[];
  /** Del más reciente al más antiguo. */
  ultimosEventos: EventoStreaming[];
}

export interface TopProductoStreaming {
  sku: string;
  nombre: string;
  unidades: number;
}

export interface StockCriticoStreaming {
  sku: string;
  nombre: string;
  stock: number;
}

export interface EventoStreaming {
  tipo: string;
  detalle: string;
  /** ISO-8601 o epoch en milisegundos. */
  timestamp: string | number;
  /** Partición del tópico de Kafka de la que se leyó el evento. */
  particion: number;
  /** Offset del evento dentro de su partición. */
  offset: number;
}

/** Resultado de cada ciclo de sondeo: nunca termina en error, para que el sondeo siga vivo. */
export type MetricsUpdate = { ok: true; metrics: StreamingMetrics } | { ok: false; error: unknown };
