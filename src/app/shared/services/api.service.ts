import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, expand, forkJoin, map, reduce, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ApiError } from '../models/api-error';
import { Category, CategoryDTO } from '../models/category.model';
import { Order, OrderStatus } from '../models/order.model';
import { Page, Product, ProductDTO, ProductFilter } from '../models/product.model';
import {
  DailySales,
  DateRange,
  InventoryValue,
  ReportData,
  ReportType,
  SalesSummary,
} from '../models/report.model';
import {
  CategoryResponse,
  CategorySalesResponse,
  InventoryValueResponse,
  OrderResponse,
  ProductResponse,
  SalesSummaryResponse,
  TopProductResponse,
  toCategory,
  toOrder,
  toProduct,
  toProductPage,
} from './api-mappers';
import { describeHttpError } from './http-error';
import { MockBackendService } from './mock-backend.service';
import { NotificationService } from './notification.service';
import { ProductService } from './product.service';

/** El backend limita `size` a 100 (`spring.data.web.pageable.max-page-size`). */
const BACKEND_MAX_PAGE_SIZE = 100;
const DAY_MS = 86_400_000;

export type DemoReason = 'unreachable' | 'dev-session';

/**
 * Cliente del backend (`environment.apiUrl`, proyecto `charmeetchic_api`).
 *
 * Con `environment.mockFallback` activo trabaja en modo demostración (todas las llamadas se resuelven
 * con `MockBackendService`, sin tocar el backend) cuando:
 *  - la sesión es la simulada de desarrollo (`devAuthBypass`): no hay token de Firebase, así que el
 *    backend rechazaría casi todo; o
 *  - el backend no responde (status 0).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockBackendService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly productLogic = inject(ProductService);
  private readonly baseUrl = environment.apiUrl;

  /** Motivo por el que los datos vienen del backend simulado; `null` si se usa el real. */
  readonly demoMode = signal<DemoReason | null>(
    environment.mockFallback && this.auth.isDevSession() ? 'dev-session' : null,
  );

  // ── Productos ───────────────────────────────────────────────

  /**
   * Página de productos (solo activos). El backend pagina y ordena, y filtra por categoría, pero no
   * filtra por precio ni stock ni busca por SKU: en esos casos se trae el catálogo completo y se
   * filtra aquí (`ProductService`).
   */
  getProducts(
    page = 0,
    size = 10,
    filter: ProductFilter = {},
    search = '',
  ): Observable<Page<Product>> {
    return this.request(
      () =>
        this.needsClientSideFiltering(filter, search)
          ? this.getProductsFilteredLocally(page, size, filter, search)
          : this.fetchProductPage(page, size, filter),
      () => this.mock.getProducts(page, size, filter, search),
    );
  }

  getProductById(id: number): Observable<Product> {
    return this.request(
      () => this.http.get<ProductResponse>(`${this.baseUrl}/products/${id}`).pipe(map(toProduct)),
      () => this.mock.getProductById(id),
    );
  }

  createProduct(dto: ProductDTO): Observable<Product> {
    return this.request(
      () => this.http.post<ProductResponse>(`${this.baseUrl}/products`, dto).pipe(map(toProduct)),
      () => this.mock.createProduct(dto),
    );
  }

  updateProduct(id: number, dto: ProductDTO): Observable<Product> {
    return this.request(
      () =>
        this.http.put<ProductResponse>(`${this.baseUrl}/products/${id}`, dto).pipe(map(toProduct)),
      () => this.mock.updateProduct(id, dto),
    );
  }

  /** Baja lógica: el backend desactiva el producto (deja de listarse), no lo borra. */
  deleteProduct(id: number): Observable<void> {
    return this.request(
      () => this.http.delete<void>(`${this.baseUrl}/products/${id}`),
      () => this.mock.deleteProduct(id),
    );
  }

  /** Productos activos con stock bajo el umbral del backend, del menor stock al mayor. */
  getLowStockProducts(): Observable<Product[]> {
    return this.request(
      () =>
        this.http
          .get<ProductResponse[]>(`${this.baseUrl}/products/low-stock`)
          .pipe(map((products) => products.map(toProduct))),
      () => this.mock.getLowStockProducts(),
    );
  }

  // ── Categorías ──────────────────────────────────────────────

  getCategories(): Observable<Category[]> {
    return this.request(
      () =>
        this.http
          .get<CategoryResponse[]>(`${this.baseUrl}/categories`)
          .pipe(map((categories) => categories.map(toCategory))),
      () => this.mock.getCategories(),
    );
  }

  createCategory(dto: CategoryDTO): Observable<Category> {
    return this.request(
      () =>
        this.http.post<CategoryResponse>(`${this.baseUrl}/categories`, dto).pipe(map(toCategory)),
      () => this.mock.createCategory(dto),
    );
  }

  updateCategory(id: number, dto: CategoryDTO): Observable<Category> {
    return this.request(
      () =>
        this.http
          .put<CategoryResponse>(`${this.baseUrl}/categories/${id}`, dto)
          .pipe(map(toCategory)),
      () => this.mock.updateCategory(id, dto),
    );
  }

  deleteCategory(id: number): Observable<void> {
    return this.request(
      () => this.http.delete<void>(`${this.baseUrl}/categories/${id}`),
      () => this.mock.deleteCategory(id),
    );
  }

  // ── Órdenes ─────────────────────────────────────────────────

  /**
   * Órdenes del usuario autenticado, la más reciente primero.
   * OJO: el backend actual no expone un listado de órdenes de *todos* los clientes.
   */
  getOrders(): Observable<Order[]> {
    return this.request(
      () =>
        this.http
          .get<OrderResponse[]>(`${this.baseUrl}/orders`)
          .pipe(map((orders) => orders.map(toOrder))),
      () => this.mock.getOrders(),
    );
  }

  /** El backend solo permite avanzar la orden al estado inmediatamente siguiente. */
  updateOrderStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.request(
      () =>
        this.http
          .put<OrderResponse>(`${this.baseUrl}/orders/${id}/status`, { status })
          .pipe(map(toOrder)),
      () => this.mock.updateOrderStatus(id, status),
    );
  }

  // ── Reportes ────────────────────────────────────────────────

  /** Reporte del tipo pedido; el backend tiene un endpoint por reporte. */
  getReports(type: ReportType, range: DateRange): Observable<ReportData> {
    const empty: ReportData = { totalSales: 0, salesByCategory: [], topProducts: [] };
    const params = this.rangeParams(range);

    return this.request(
      () => {
        switch (type) {
          case 'BY_CATEGORY':
            return this.http
              .get<CategorySalesResponse[]>(`${this.baseUrl}/reports/sales-by-category`, { params })
              .pipe(
                map((rows) => ({
                  ...empty,
                  totalSales: rows.reduce((sum, r) => sum + r.revenue, 0),
                  salesByCategory: rows.map((r) => ({
                    category: r.category,
                    amount: r.revenue,
                    units: r.unitsSold,
                  })),
                })),
              );
          case 'TOP_PRODUCTS':
            return this.http
              .get<TopProductResponse[]>(`${this.baseUrl}/reports/top-products`, { params })
              .pipe(
                map((rows) => ({
                  ...empty,
                  topProducts: rows.map((r) => ({
                    name: r.name,
                    sold: r.unitsSold,
                    sku: r.sku,
                    revenue: r.revenue,
                  })),
                })),
              );
          default:
            return this.fetchSalesSummary(range).pipe(
              map((summary) => ({ ...empty, totalSales: summary.totalSales, summary })),
            );
        }
      },
      () => this.mock.getReports(type, range),
    );
  }

  /** Valor del inventario activo (a costo y a precio de venta). */
  getInventoryValue(): Observable<InventoryValue> {
    return this.request(
      () => this.http.get<InventoryValueResponse>(`${this.baseUrl}/reports/inventory-value`),
      () => this.mock.getInventoryValue(),
    );
  }

  /** Ventas de cada uno de los últimos `days` días (incluye hoy), en orden cronológico. */
  getSalesByDay(days = 7): Observable<DailySales[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = Array.from(
      { length: days },
      (_, i) => new Date(today.getTime() - (days - 1 - i) * DAY_MS),
    );

    return this.request(
      () =>
        forkJoin(
          dates.map((date) =>
            this.fetchSalesSummary({ from: date, to: date }).pipe(
              map((summary) => ({ date, amount: summary.totalSales, orders: summary.orderCount })),
            ),
          ),
        ),
      () => this.mock.getSalesByDay(dates),
    );
  }

  // ── Interno ─────────────────────────────────────────────────

  private needsClientSideFiltering(filter: ProductFilter, search: string): boolean {
    return (
      !!search.trim() ||
      filter.minPrice != null ||
      filter.maxPrice != null ||
      filter.minStock != null ||
      filter.maxStock != null
    );
  }

  private fetchProductPage(
    page: number,
    size: number,
    filter: ProductFilter,
  ): Observable<Page<Product>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', Math.min(size, BACKEND_MAX_PAGE_SIZE));
    if (filter.sortBy) {
      const field = filter.sortBy === 'category' ? 'category.name' : filter.sortBy;
      params = params.set('sort', `${field},${filter.sortDir ?? 'asc'}`);
    }
    // /products/search acepta la categoría; /products no.
    let url = `${this.baseUrl}/products`;
    if (filter.categoryId != null) {
      url += '/search';
      params = params.set('category', filter.categoryId);
    }
    return this.http.get<Page<ProductResponse>>(url, { params }).pipe(map(toProductPage));
  }

  /** Trae todas las páginas del catálogo (de a 100) y filtra, ordena y pagina en el cliente. */
  private getProductsFilteredLocally(
    page: number,
    size: number,
    filter: ProductFilter,
    search: string,
  ): Observable<Page<Product>> {
    const firstPage = { categoryId: filter.categoryId, sortBy: 'name' as const };
    return this.fetchProductPage(0, BACKEND_MAX_PAGE_SIZE, firstPage).pipe(
      expand((result) =>
        result.number + 1 < result.totalPages
          ? this.fetchProductPage(result.number + 1, BACKEND_MAX_PAGE_SIZE, firstPage)
          : EMPTY,
      ),
      reduce((all, result) => all.concat(result.content), [] as Product[]),
      map((all) => {
        let products = this.productLogic.filterProducts(all, filter);
        products = this.productLogic.searchProducts(products, search);
        products = this.productLogic.sortProducts(products, filter.sortBy, filter.sortDir);
        const start = page * size;
        return {
          content: products.slice(start, start + size),
          totalElements: products.length,
          totalPages: Math.ceil(products.length / size),
          number: page,
          size,
        };
      }),
    );
  }

  private fetchSalesSummary(range: DateRange): Observable<SalesSummary> {
    return this.http.get<SalesSummaryResponse>(`${this.baseUrl}/reports/sales`, {
      params: this.rangeParams(range),
    });
  }

  private rangeParams(range: DateRange): HttpParams {
    return new HttpParams().set('from', toIsoDate(range.from)).set('to', toIsoDate(range.to));
  }

  private request<T>(real: () => Observable<T>, mock: () => Observable<T>): Observable<T> {
    if (this.demoMode()) {
      return this.mockRequest(mock);
    }
    return real().pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const reason = this.demoReasonFor(error);
          if (reason) {
            this.demoMode.set(reason);
            return this.mockRequest(mock);
          }
          return throwError(() => new ApiError(describeHttpError(error), error.status));
        }
        return throwError(() => error);
      }),
    );
  }

  private demoReasonFor(error: HttpErrorResponse): DemoReason | null {
    if (!environment.mockFallback) {
      return null;
    }
    return error.status === 0 ? 'unreachable' : null;
  }

  /** El backend simulado no pasa por los interceptores HTTP, así que avisa del error aquí. */
  private mockRequest<T>(mock: () => Observable<T>): Observable<T> {
    return mock().pipe(
      catchError((error: unknown) => {
        if (error instanceof ApiError) {
          this.notifications.error(error.message);
        }
        return throwError(() => error);
      }),
    );
  }
}

/** yyyy-MM-dd en hora local (`toISOString` usa UTC y podría correr el día). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
