import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PAGE_SIZE_OPTIONS } from '../../../../shared/constants';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  Order,
  OrderStatus,
  nextOrderStatus,
} from '../../../../shared/models/order.model';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { ApiService } from '../../../../shared/services/api.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PreferencesService } from '../../../../shared/services/preferences.service';
import { OrderDetailDialogComponent } from './order-detail-dialog/order-detail-dialog.component';

type StatusFilter = OrderStatus | 'ALL';

@Component({
  selector: 'app-orders-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
    PricePipe,
  ],
  templateUrl: './orders-list.component.html',
  styleUrl: './orders-list.component.css',
})
export class OrdersListComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['id', 'createdAt', 'userId', 'items', 'total', 'status', 'actions'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly pageSize = inject(PreferencesService).pageSize();
  protected readonly statuses = ORDER_STATUSES;
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected readonly dataSource = new MatTableDataSource<Order>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  /** Orden cuyo estado se está actualizando (deshabilita su botón mientras responde). */
  protected readonly updatingId = signal<number | null>(null);
  protected readonly counts = signal<Record<StatusFilter, number>>({
    ALL: 0,
    PENDING: 0,
    PROCESSING: 0,
    SENT: 0,
    DELIVERED: 0,
  });

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (order, status) =>
      status === 'ALL' || order.status === status;
    this.dataSource.filter = 'ALL';
    this.dataSource.sortingDataAccessor = (order, key) => {
      switch (key) {
        case 'createdAt':
          return order.createdAt.getTime();
        case 'items':
          return this.itemCount(order);
        case 'id':
        case 'total':
          return order[key];
        default:
          return String(order[key as 'userId' | 'status']).toLowerCase();
      }
    };

    effect(() => {
      this.dataSource.sort = this.sort() ?? null;
      this.dataSource.paginator = this.paginator() ?? null;
    });

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getOrders().subscribe({
      next: (orders) => {
        this.setOrders(orders);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected filterBy(status: StatusFilter): void {
    this.statusFilter.set(status);
    this.dataSource.filter = status;
    this.dataSource.paginator?.firstPage();
  }

  protected statusLabel(order: Order): string {
    return ORDER_STATUS_LABELS[order.status];
  }

  /** Estado siguiente en el ciclo de vida; `null` si la orden ya está entregada. */
  protected nextStatus(order: Order): OrderStatus | null {
    return nextOrderStatus(order.status);
  }

  protected nextLabel(order: Order): string {
    const next = nextOrderStatus(order.status);
    return next ? ORDER_STATUS_LABELS[next] : '';
  }

  protected itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  protected openDetail(order: Order): void {
    this.dialog.open(OrderDetailDialogComponent, {
      data: order,
      width: '640px',
      maxWidth: '95vw',
    });
  }

  /** Avanza la orden al estado siguiente (el backend no admite saltos ni retrocesos). */
  protected advance(order: Order): void {
    const next = nextOrderStatus(order.status);
    if (!next) {
      return;
    }
    this.updatingId.set(order.id);
    this.api.updateOrderStatus(order.id, next).subscribe({
      next: (updated) => {
        this.setOrders(this.dataSource.data.map((o) => (o.id === updated.id ? updated : o)));
        this.notifications.success(
          `Orden #${order.id} marcada como "${ORDER_STATUS_LABELS[next]}".`,
        );
        this.updatingId.set(null);
      },
      error: () => this.updatingId.set(null),
    });
  }

  private setOrders(orders: Order[]): void {
    this.dataSource.data = orders;
    const counts: Record<StatusFilter, number> = {
      ALL: orders.length,
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      DELIVERED: 0,
    };
    for (const order of orders) {
      counts[order.status]++;
    }
    this.counts.set(counts);
  }
}
