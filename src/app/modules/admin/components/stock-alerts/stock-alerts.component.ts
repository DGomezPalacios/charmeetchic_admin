import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { LOW_STOCK_THRESHOLD } from '../../../../shared/constants';
import { ProductImageDirective } from '../../../../shared/directives/product-image.directive';
import { Product, StockLevel } from '../../../../shared/models/product.model';
import { ApiService } from '../../../../shared/services/api.service';
import { ProductService } from '../../../../shared/services/product.service';

@Component({
  selector: 'app-stock-alerts',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    LoadingSpinnerComponent,
    ProductImageDirective,
  ],
  templateUrl: './stock-alerts.component.html',
  styleUrl: './stock-alerts.component.css',
})
export class StockAlertsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly productLogic = inject(ProductService);

  protected readonly columns = ['name', 'sku', 'category', 'stock', 'actions'];
  protected readonly threshold = LOW_STOCK_THRESHOLD;

  protected readonly dataSource = new MatTableDataSource<Product>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly total = signal(0);
  protected readonly outOfStock = signal(0);
  protected readonly critical = signal(0);

  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (product, key) => {
      switch (key) {
        case 'name':
          return product.name.toLowerCase();
        case 'sku':
          return product.sku;
        case 'category':
          return product.category.name.toLowerCase();
        default:
          return product.stock;
      }
    };
    effect(() => {
      this.dataSource.sort = this.sort() ?? null;
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getLowStockProducts().subscribe({
      next: (products) => {
        this.dataSource.data = products;
        this.total.set(products.length);
        this.outOfStock.set(products.filter((p) => p.stock <= 0).length);
        this.critical.set(products.filter((p) => this.level(p) === 'critical').length);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected level(product: Product): StockLevel {
    return this.productLogic.stockLevel(product.stock);
  }

  protected icon(level: StockLevel): string {
    return { out: 'error', critical: 'priority_high', low: 'warning', ok: 'check_circle' }[level];
  }

  protected label(level: StockLevel): string {
    return { out: 'Agotado', critical: 'Crítico', low: 'Bajo', ok: 'Suficiente' }[level];
  }

  /** Lleva a Inventario con el formulario de edición de ese producto abierto. */
  protected increaseStock(product: Product): void {
    void this.router.navigate(['/inventory'], { queryParams: { edit: product.id } });
  }
}
