import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { LOW_STOCK_THRESHOLD } from '../../../../shared/constants';
import { Order, ORDER_STATUS_LABELS } from '../../../../shared/models/order.model';
import { Product } from '../../../../shared/models/product.model';
import { DailySales, InventoryValue } from '../../../../shared/models/report.model';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { ApiService } from '../../../../shared/services/api.service';
import { ProductService } from '../../../../shared/services/product.service';

interface DashboardData {
  inventory: InventoryValue;
  lowStock: Product[];
  sales: DailySales[];
  orders: Order[];
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ChartComponent,
    LoadingSpinnerComponent,
    PricePipe,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly productLogic = inject(ProductService);

  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly lowStockThreshold = LOW_STOCK_THRESHOLD;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly data = signal<DashboardData | null>(null);

  protected readonly inventory = computed(() => this.data()?.inventory ?? null);
  protected readonly lowStock = computed(() => this.data()?.lowStock ?? []);

  /** Las 5 órdenes más recientes (el backend las entrega de la más reciente a la más antigua). */
  protected readonly recentOrders = computed(() => (this.data()?.orders ?? []).slice(0, 5));

  protected readonly weekTotal = computed(() =>
    (this.data()?.sales ?? []).reduce((sum, day) => sum + day.amount, 0),
  );
  protected readonly weekOrders = computed(() =>
    (this.data()?.sales ?? []).reduce((sum, day) => sum + day.orders, 0),
  );

  private readonly dayFormatter = new Intl.DateTimeFormat(environment.app.locale, {
    weekday: 'short',
    day: 'numeric',
  });
  protected readonly chartLabels = computed(() =>
    (this.data()?.sales ?? []).map((day) => this.dayFormatter.format(day.date)),
  );
  protected readonly chartValues = computed(() =>
    (this.data()?.sales ?? []).map((day) => day.amount),
  );
  protected readonly formatMoney = (value: number) => this.productLogic.formatPrice(value);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      inventory: this.api.getInventoryValue(),
      lowStock: this.api.getLowStockProducts(),
      sales: this.api.getSalesByDay(7),
      // Las órdenes recientes son secundarias: si fallan, el resto del resumen se muestra igual.
      orders: this.api.getOrders().pipe(catchError(() => of([] as Order[]))),
    }).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
