import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { ApiError } from '../models/api-error';
import { Category, CategoryDTO } from '../models/category.model';
import { Order, OrderStatus, nextOrderStatus } from '../models/order.model';
import { Page, Product, ProductDTO, ProductFilter } from '../models/product.model';
import {
  DailySales,
  DateRange,
  InventoryValue,
  ReportData,
  ReportType,
} from '../models/report.model';
import { buildMockOrders, buildMockProducts, MOCK_CATEGORIES } from './mock-data';
import { ProductService } from './product.service';

/**
 * Backend en memoria con el mismo contrato y reglas que `charmeetchic_api`: solo productos activos,
 * baja lógica, bloqueo optimista por `version`, órdenes que solo avanzan al estado siguiente.
 * `ApiService` lo usa cuando el backend no responde (o rechaza la sesión de desarrollo) y
 * `environment.mockFallback` está activo. Los datos se reinician al recargar la página.
 */
@Injectable({ providedIn: 'root' })
export class MockBackendService {
  private readonly productLogic = inject(ProductService);

  /** Latencia simulada (ms) para que los spinners sean visibles. */
  latencyMs = 250;

  private categories: Category[] = MOCK_CATEGORIES.map((c) => ({ ...c }));
  private products: Product[] = buildMockProducts().map((p) => ({
    ...p,
    category: this.categories.find((c) => c.id === p.category.id) as Category,
  }));
  private orders: Order[] = buildMockOrders(this.products);
  private nextProductId = this.products.length + 1;
  private nextCategoryId = this.categories.length + 1;

  // ── Productos ───────────────────────────────────────────────

  getProducts(
    page: number,
    size: number,
    filter: ProductFilter,
    search: string,
  ): Observable<Page<Product>> {
    return this.reply(() => {
      let result = this.productLogic.filterProducts(this.activeProducts(), filter);
      result = this.productLogic.searchProducts(result, search);
      result = this.productLogic.sortProducts(result, filter.sortBy, filter.sortDir);
      const start = page * size;
      return {
        content: result.slice(start, start + size).map((p) => ({ ...p })),
        totalElements: result.length,
        totalPages: Math.ceil(result.length / size),
        number: page,
        size,
      };
    });
  }

  getProductById(id: number): Observable<Product> {
    // Como en el backend, un producto inactivo se comporta como inexistente.
    return this.reply(() => {
      const product = this.requireProduct(id);
      if (!product.active) {
        throw new ApiError('Producto no encontrado.', 404);
      }
      return { ...product };
    });
  }

  getLowStockProducts(): Observable<Product[]> {
    return this.reply(() =>
      this.activeProducts()
        .filter((p) => p.stock < LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.stock - b.stock)
        .map((p) => ({ ...p })),
    );
  }

  createProduct(dto: ProductDTO): Observable<Product> {
    return this.reply(() => {
      const sku = dto.sku.trim().toUpperCase();
      this.assertUniqueSku(sku);
      const now = new Date();
      const product: Product = {
        ...dto,
        sku,
        id: this.nextProductId++,
        category: this.requireCategory(dto.categoryId),
        createdAt: now,
        updatedAt: now,
        version: 0,
      };
      this.products = [...this.products, product];
      return { ...product };
    });
  }

  updateProduct(id: number, dto: ProductDTO): Observable<Product> {
    return this.reply(() => {
      const current = this.requireProduct(id);
      if (dto.version != null && dto.version !== current.version) {
        throw new ApiError(
          'El recurso fue modificado por otra operación. Vuelve a consultarlo e inténtalo de nuevo.',
          409,
        );
      }
      const sku = dto.sku.trim().toUpperCase();
      this.assertUniqueSku(sku, id);
      const updated: Product = {
        ...current,
        ...dto,
        sku,
        category: this.requireCategory(dto.categoryId),
        updatedAt: new Date(),
        version: (current.version ?? 0) + 1,
      };
      this.products = this.products.map((p) => (p.id === id ? updated : p));
      return { ...updated };
    });
  }

  /** Baja lógica, igual que el backend. */
  deleteProduct(id: number): Observable<void> {
    return this.reply(() => {
      const product = this.requireProduct(id);
      this.products = this.products.map((p) => (p.id === product.id ? { ...p, active: false } : p));
    });
  }

  // ── Categorías ──────────────────────────────────────────────

  getCategories(): Observable<Category[]> {
    return this.reply(() =>
      [...this.categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ ...c })),
    );
  }

  createCategory(dto: CategoryDTO): Observable<Category> {
    return this.reply(() => {
      this.assertUniqueCategoryName(dto.name);
      const category: Category = { id: this.nextCategoryId++, ...dto, createdAt: new Date() };
      this.categories = [...this.categories, category];
      return { ...category };
    });
  }

  updateCategory(id: number, dto: CategoryDTO): Observable<Category> {
    return this.reply(() => {
      const current = this.requireCategory(id);
      this.assertUniqueCategoryName(dto.name, id);
      const updated: Category = { ...current, ...dto };
      this.categories = this.categories.map((c) => (c.id === id ? updated : c));
      // Los productos guardan la categoría embebida: se mantiene consistente.
      this.products = this.products.map((p) =>
        p.category.id === id ? { ...p, category: updated } : p,
      );
      return { ...updated };
    });
  }

  deleteCategory(id: number): Observable<void> {
    return this.reply(() => {
      this.requireCategory(id);
      if (this.products.some((p) => p.category.id === id)) {
        throw new ApiError(
          'No se puede eliminar una categoría que tiene productos asociados.',
          409,
        );
      }
      this.categories = this.categories.filter((c) => c.id !== id);
    });
  }

  // ── Órdenes ─────────────────────────────────────────────────

  getOrders(): Observable<Order[]> {
    return this.reply(() => this.orders.map((o) => ({ ...o })));
  }

  updateOrderStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.reply(() => {
      const order = this.orders.find((o) => o.id === id);
      if (!order) {
        throw new ApiError('Orden no encontrada.', 404);
      }
      const next = nextOrderStatus(order.status);
      if (status !== next) {
        const allowed = next
          ? `el único estado permitido es ${next}`
          : 'la orden ya fue entregada y no admite más cambios';
        throw new ApiError(`Transición inválida ${order.status} -> ${status}: ${allowed}`, 400);
      }
      const updated = { ...order, status, updatedAt: new Date() };
      this.orders = this.orders.map((o) => (o.id === id ? updated : o));
      return { ...updated };
    });
  }

  // ── Reportes ────────────────────────────────────────────────

  getReports(type: ReportType, range: DateRange): Observable<ReportData> {
    return this.reply(() => {
      const inRange = this.ordersIn(range);
      const report: ReportData = { totalSales: 0, salesByCategory: [], topProducts: [] };

      if (type === 'BY_CATEGORY' || type === 'TOP_PRODUCTS') {
        const byCategory = new Map<string, { amount: number; units: number }>();
        const byProduct = new Map<
          number,
          { name: string; sku: string; sold: number; revenue: number }
        >();
        for (const order of inRange) {
          for (const item of order.items) {
            const category =
              this.products.find((p) => p.id === item.productId)?.category.name ?? '—';
            const c = byCategory.get(category) ?? { amount: 0, units: 0 };
            byCategory.set(category, {
              amount: c.amount + item.subtotal,
              units: c.units + item.quantity,
            });
            const p = byProduct.get(item.productId) ?? {
              name: item.productName,
              sku: item.sku,
              sold: 0,
              revenue: 0,
            };
            byProduct.set(item.productId, {
              ...p,
              sold: p.sold + item.quantity,
              revenue: p.revenue + item.subtotal,
            });
          }
        }
        if (type === 'BY_CATEGORY') {
          report.salesByCategory = [...byCategory]
            .map(([category, v]) => ({ category, amount: v.amount, units: v.units }))
            .sort((a, b) => b.amount - a.amount);
          report.totalSales = report.salesByCategory.reduce((sum, r) => sum + r.amount, 0);
        } else {
          report.topProducts = [...byProduct.values()].sort((a, b) => b.sold - a.sold).slice(0, 10);
        }
      } else {
        const subtotal = inRange.reduce((sum, o) => sum + o.subtotal, 0);
        const tax = inRange.reduce((sum, o) => sum + o.tax, 0);
        const totalSales = subtotal + tax;
        report.totalSales = totalSales;
        report.summary = {
          orderCount: inRange.length,
          subtotal,
          tax,
          totalSales,
          averageOrderValue: inRange.length ? Math.round(totalSales / inRange.length) : 0,
        };
      }
      return report;
    });
  }

  getInventoryValue(): Observable<InventoryValue> {
    return this.reply(() => {
      const active = this.activeProducts();
      const costValue = active.reduce((sum, p) => sum + p.stock * p.cost, 0);
      const retailValue = active.reduce((sum, p) => sum + p.stock * p.price, 0);
      return {
        activeProducts: active.length,
        totalUnits: active.reduce((sum, p) => sum + p.stock, 0),
        costValue,
        retailValue,
        potentialProfit: retailValue - costValue,
      };
    });
  }

  getSalesByDay(dates: Date[]): Observable<DailySales[]> {
    return this.reply(() =>
      dates.map((date) => {
        const orders = this.ordersIn({ from: date, to: date });
        return { date, amount: orders.reduce((sum, o) => sum + o.total, 0), orders: orders.length };
      }),
    );
  }

  // ── Utilidades ──────────────────────────────────────────────

  /** Ejecuta `fn` tras la latencia simulada; sus excepciones salen como errores del Observable. */
  private reply<T>(fn: () => T): Observable<T> {
    const source$ = this.latencyMs > 0 ? timer(this.latencyMs) : of(0);
    return source$.pipe(
      mergeMap(() => {
        try {
          return of(fn());
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );
  }

  private activeProducts(): Product[] {
    return this.products.filter((p) => p.active);
  }

  private ordersIn(range: DateRange): Order[] {
    const from = new Date(range.from).setHours(0, 0, 0, 0);
    const to = new Date(range.to).setHours(23, 59, 59, 999);
    return this.orders.filter((o) => o.createdAt.getTime() >= from && o.createdAt.getTime() <= to);
  }

  private requireProduct(id: number): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new ApiError('Producto no encontrado.', 404);
    }
    return product;
  }

  private requireCategory(id: number): Category {
    const category = this.categories.find((c) => c.id === id);
    if (!category) {
      throw new ApiError('Categoría no encontrada.', 404);
    }
    return category;
  }

  private assertUniqueSku(sku: string, ignoreId?: number): void {
    if (this.products.some((p) => p.id !== ignoreId && p.sku === sku)) {
      throw new ApiError(`Ya existe un producto con SKU '${sku}'`, 409);
    }
  }

  private assertUniqueCategoryName(name: string, ignoreId?: number): void {
    const taken = this.categories.some(
      (c) => c.id !== ignoreId && c.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (taken) {
      throw new ApiError(`Ya existe una categoría llamada "${name}".`, 409);
    }
  }
}
