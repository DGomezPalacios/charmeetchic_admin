/**
 * Resultado de un reporte. El backend expone un endpoint por reporte, así que `ApiService.getReports`
 * rellena solo la parte que corresponde al tipo pedido; el resto queda vacío.
 */
export interface ReportData {
  totalSales: number;
  salesByCategory: { category: string; amount: number; units?: number }[];
  topProducts: { name: string; sold: number; sku?: string; revenue?: number }[];
  /** Solo en `TOTAL_SALES`. */
  summary?: SalesSummary;
}

export interface SalesSummary {
  orderCount: number;
  subtotal: number;
  tax: number;
  totalSales: number;
  averageOrderValue: number;
}

export interface InventoryValue {
  activeProducts: number;
  totalUnits: number;
  /** Lo invertido (stock × costo). */
  costValue: number;
  /** Lo potencial (stock × precio de venta). */
  retailValue: number;
  potentialProfit: number;
}

export interface DailySales {
  date: Date;
  amount: number;
  orders: number;
}

export type ReportType = 'TOTAL_SALES' | 'BY_CATEGORY' | 'TOP_PRODUCTS';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  TOTAL_SALES: 'Total de ventas',
  BY_CATEGORY: 'Ventas por categoría',
  TOP_PRODUCTS: 'Productos más vendidos',
};

export interface DateRange {
  from: Date;
  to: Date;
}
