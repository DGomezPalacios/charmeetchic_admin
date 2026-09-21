import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { LOW_STOCK_THRESHOLD, PAGE_SIZE_OPTIONS } from '../../../../shared/constants';
import { Category } from '../../../../shared/models/category.model';
import {
  Product,
  ProductFilter,
  ProductSortField,
  StockLevel,
} from '../../../../shared/models/product.model';
import { ProductImageDirective } from '../../../../shared/directives/product-image.directive';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { ApiService } from '../../../../shared/services/api.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PreferencesService } from '../../../../shared/services/preferences.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ProductService } from '../../../../shared/services/product.service';
import { ProductDetailDialogComponent } from './product-detail-dialog/product-detail-dialog.component';
import {
  ProductFormDialogComponent,
  ProductFormDialogData,
} from './product-form-dialog/product-form-dialog.component';

type StockFilter = 'all' | 'ok' | 'low' | 'out';

@Component({
  selector: 'app-inventory-management',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
    PricePipe,
    ProductImageDirective,
  ],
  templateUrl: './inventory-management.component.html',
  styleUrl: './inventory-management.component.css',
})
export class InventoryManagementComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly preferences = inject(PreferencesService);
  private readonly productLogic = inject(ProductService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  /** Sin rol ADMIN el inventario solo se consulta: no se crea, edita ni elimina. */
  protected readonly isReadOnly = computed(() => !this.auth.isAdmin());

  /** `?edit=<id>` abre directamente la edición de ese producto (desde Alertas de stock). */
  readonly edit = input<string>();

  protected readonly columns = ['name', 'sku', 'category', 'price', 'stock', 'actions'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly lowStockThreshold = LOW_STOCK_THRESHOLD;

  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(this.preferences.pageSize());
  protected readonly sort = signal<{ active: ProductSortField; direction: 'asc' | 'desc' }>({
    active: 'name',
    direction: 'asc',
  });
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl<number | null>(null),
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null),
    stock: new FormControl<StockFilter>('all', { nonNullable: true }),
  });

  private readonly reload$ = new Subject<void>();

  constructor() {
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (categories) => this.categories.set(categories) });

    // switchMap descarta la respuesta anterior si el usuario cambia de filtro o de página.
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap(() =>
          this.api
            .getProducts(
              this.pageIndex(),
              this.pageSize(),
              this.buildFilter(),
              this.filters.controls.search.value,
            )
            .pipe(
              catchError(() => {
                this.failed.set(true);
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        if (page) {
          this.products.set(page.content);
          this.total.set(page.totalElements);
        }
        this.loading.set(false);
      });

    this.filters.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex.set(0);
        this.reload$.next();
      });

    effect(() => {
      const id = Number(this.edit());
      if (Number.isInteger(id) && id > 0) {
        untracked(() => this.openEditById(id));
      }
    });

    this.reload$.next();
  }

  protected hasActiveFilters(): boolean {
    const { search, categoryId, minPrice, maxPrice, stock } = this.filters.getRawValue();
    return (
      !!search || categoryId != null || minPrice != null || maxPrice != null || stock !== 'all'
    );
  }

  protected clearFilters(): void {
    this.filters.reset({
      search: '',
      categoryId: null,
      minPrice: null,
      maxPrice: null,
      stock: 'all',
    });
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload$.next();
  }

  protected onSort(event: Sort): void {
    this.sort.set({
      active: (event.direction ? event.active : 'name') as ProductSortField,
      direction: event.direction === 'desc' ? 'desc' : 'asc',
    });
    this.pageIndex.set(0);
    this.reload$.next();
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected stockLevel(stock: number): StockLevel {
    return this.productLogic.stockLevel(stock);
  }

  protected stockIcon(level: StockLevel): string {
    return { out: 'error', critical: 'priority_high', low: 'warning', ok: 'check_circle' }[level];
  }

  protected stockLabel(level: StockLevel): string {
    return { out: 'Agotado', critical: 'Crítico', low: 'Bajo', ok: 'Suficiente' }[level];
  }

  // ── Acciones ────────────────────────────────────────────────

  protected openCreate(): void {
    this.openForm();
  }

  protected openEdit(product: Product): void {
    this.openForm(product);
  }

  protected openDetail(product: Product): void {
    this.dialog
      .open(ProductDetailDialogComponent, { data: product, width: '560px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'edit') {
          this.openForm(product);
        }
      });
  }

  protected confirmDelete(product: Product): void {
    if (this.isReadOnly()) {
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Eliminar producto',
          message: `¿Dar de baja "${product.name}" (${product.sku})? Dejará de mostrarse en el catálogo (baja lógica: el historial de órdenes se conserva).`,
          confirmText: 'Dar de baja',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.delete(product);
        }
      });
  }

  private delete(product: Product): void {
    this.loading.set(true);
    this.api.deleteProduct(product.id).subscribe({
      next: () => {
        this.notifications.success(`Producto "${product.name}" dado de baja.`);
        // Si era el último de la página, retrocede una para no quedar en una página vacía.
        if (this.products().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.reload$.next();
      },
      error: () => this.loading.set(false),
    });
  }

  private openEditById(id: number): void {
    // Limpia el query param para que recargar la página no vuelva a abrir el diálogo.
    void this.router.navigate([], { queryParams: { edit: null }, replaceUrl: true });
    if (this.isReadOnly()) {
      return;
    }
    this.api.getProductById(id).subscribe({
      next: (product) => this.openForm(product),
      error: () => this.notifications.error('No se encontró el producto solicitado.'),
    });
  }

  private openForm(product?: Product): void {
    if (this.isReadOnly()) {
      return;
    }
    const data: ProductFormDialogData = { product, categories: this.categories() };
    this.dialog
      .open(ProductFormDialogComponent, {
        data,
        width: '640px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }

  private buildFilter(): ProductFilter {
    const { categoryId, minPrice, maxPrice, stock } = this.filters.getRawValue();
    const filter: ProductFilter = {
      categoryId,
      minPrice,
      maxPrice,
      sortBy: this.sort().active,
      sortDir: this.sort().direction,
    };
    switch (stock) {
      case 'low':
        filter.maxStock = LOW_STOCK_THRESHOLD - 1;
        break;
      case 'out':
        filter.maxStock = 0;
        break;
      case 'ok':
        filter.minStock = LOW_STOCK_THRESHOLD;
        break;
    }
    return filter;
  }
}
