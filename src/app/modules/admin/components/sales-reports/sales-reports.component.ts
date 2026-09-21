import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import {
  DateRange,
  REPORT_TYPE_LABELS,
  ReportData,
  ReportType,
} from '../../../../shared/models/report.model';
import { ApiService, toIsoDate } from '../../../../shared/services/api.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { ProductService } from '../../../../shared/services/product.service';
import { CsvCell, CsvExportService } from '../../services/csv-export.service';

interface ReportView {
  headers: string[];
  /** Columnas numéricas (se alinean a la derecha). */
  numeric: boolean[];
  display: string[][];
  raw: CsvCell[][];
}

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-sales-reports',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    ChartComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './sales-reports.component.html',
  styleUrl: './sales-reports.component.css',
})
export class SalesReportsComponent {
  private readonly api = inject(ApiService);
  private readonly csv = inject(CsvExportService);
  private readonly notifications = inject(NotificationService);
  private readonly productLogic = inject(ProductService);

  protected readonly reportTypes = Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][];
  protected readonly today = new Date();

  protected readonly filters = new FormGroup({
    type: new FormControl<ReportType>('TOTAL_SALES', { nonNullable: true }),
    start: new FormControl<Date | null>(new Date(Date.now() - 29 * DAY_MS), Validators.required),
    end: new FormControl<Date | null>(new Date(), Validators.required),
  });

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly report = signal<ReportData | null>(null);
  /** Tipo y período con los que se generó el reporte mostrado (no cambian al editar el formulario). */
  protected readonly shown = signal<{ type: ReportType; range: DateRange } | null>(null);

  protected readonly formatMoney = (value: number) => this.productLogic.formatPrice(value);

  protected readonly title = computed(() => {
    const shown = this.shown();
    return shown ? REPORT_TYPE_LABELS[shown.type] : '';
  });

  protected readonly view = computed<ReportView | null>(() => {
    const report = this.report();
    const shown = this.shown();
    if (!report || !shown) {
      return null;
    }
    const money = this.formatMoney;

    switch (shown.type) {
      case 'BY_CATEGORY': {
        const total = report.salesByCategory.reduce((sum, row) => sum + row.amount, 0);
        const percent = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);
        return {
          headers: ['Categoría', 'Unidades', 'Ventas (sin IVA)', '% del total'],
          numeric: [false, true, true, true],
          display: report.salesByCategory.map((r) => [
            r.category,
            String(r.units ?? 0),
            money(r.amount),
            `${percent(r.amount).toFixed(1)}%`,
          ]),
          raw: report.salesByCategory.map((r) => [
            r.category,
            r.units ?? 0,
            r.amount,
            Number(percent(r.amount).toFixed(1)),
          ]),
        };
      }
      case 'TOP_PRODUCTS':
        return {
          headers: ['#', 'Producto', 'SKU', 'Unidades vendidas', 'Ingresos (sin IVA)'],
          numeric: [true, false, false, true, true],
          display: report.topProducts.map((r, i) => [
            String(i + 1),
            r.name,
            r.sku ?? '',
            String(r.sold),
            money(r.revenue ?? 0),
          ]),
          raw: report.topProducts.map((r, i) => [
            i + 1,
            r.name,
            r.sku ?? '',
            r.sold,
            r.revenue ?? 0,
          ]),
        };
      default: {
        const summary = report.summary;
        // Sin órdenes en el período no hay nada que mostrar ni exportar.
        const rows: [string, string, CsvCell][] =
          summary && summary.orderCount > 0
            ? [
                ['Total de ventas (con IVA)', money(summary.totalSales), summary.totalSales],
                ['Subtotal (sin IVA)', money(summary.subtotal), summary.subtotal],
                ['IVA', money(summary.tax), summary.tax],
                ['Órdenes', String(summary.orderCount), summary.orderCount],
                ['Ticket promedio', money(summary.averageOrderValue), summary.averageOrderValue],
              ]
            : [];
        return {
          headers: ['Indicador', 'Valor'],
          numeric: [false, true],
          display: rows.map(([label, text]) => [label, text]),
          raw: rows.map(([label, , value]) => [label, value]),
        };
      }
    }
  });

  protected readonly columns = computed(() => this.view()?.headers.map((_, i) => `c${i}`) ?? []);

  protected readonly chart = computed(() => {
    const report = this.report();
    switch (this.shown()?.type) {
      case 'BY_CATEGORY':
        return {
          labels: report?.salesByCategory.map((r) => r.category) ?? [],
          values: report?.salesByCategory.map((r) => r.amount) ?? [],
          seriesLabel: 'Ventas',
          format: this.formatMoney,
        };
      case 'TOP_PRODUCTS':
        return {
          labels: report?.topProducts.map((r) => r.name) ?? [],
          values: report?.topProducts.map((r) => r.sold) ?? [],
          seriesLabel: 'Unidades vendidas',
          format: (value: number) => `${value} u.`,
        };
      default:
        return null;
    }
  });

  protected readonly hasRows = computed(() => (this.view()?.display.length ?? 0) > 0);

  constructor() {
    this.generate();
  }

  protected generate(): void {
    if (this.filters.invalid) {
      this.filters.markAllAsTouched();
      return;
    }
    const { type, start, end } = this.filters.getRawValue();
    const range: DateRange = { from: start as Date, to: end as Date };

    this.loading.set(true);
    this.failed.set(false);
    this.api.getReports(type, range).subscribe({
      next: (report) => {
        this.report.set(report);
        this.shown.set({ type, range });
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected exportCsv(): void {
    const view = this.view();
    const shown = this.shown();
    if (!view || !shown || view.raw.length === 0) {
      this.notifications.info('No hay datos para exportar.');
      return;
    }
    const period = `${toIsoDate(shown.range.from)}_${toIsoDate(shown.range.to)}`;
    this.csv.download(`reporte-${shown.type.toLowerCase()}-${period}.csv`, view.headers, view.raw);
  }

  protected chartHeight(rows: number): number {
    return Math.max(120, rows * 34 + 32);
  }
}
