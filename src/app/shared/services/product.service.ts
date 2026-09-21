import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CRITICAL_STOCK_THRESHOLD, LOW_STOCK_THRESHOLD } from '../constants';
import { Product, ProductFilter, ProductSortField, StockLevel } from '../models/product.model';

/** Lógica local sobre productos (sin llamadas HTTP). */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly currencyFormat = new Intl.NumberFormat(environment.app.locale, {
    style: 'currency',
    currency: environment.app.currency,
    maximumFractionDigits: environment.app.currency === 'CLP' ? 0 : 2,
  });

  formatPrice(price: number | null | undefined): string {
    return this.currencyFormat.format(price ?? 0);
  }

  filterProducts(products: Product[], filters: ProductFilter): Product[] {
    const { categoryId, minPrice, maxPrice, minStock, maxStock } = filters;
    return products.filter(
      (p) =>
        (categoryId == null || p.category.id === categoryId) &&
        (minPrice == null || p.price >= minPrice) &&
        (maxPrice == null || p.price <= maxPrice) &&
        (minStock == null || p.stock >= minStock) &&
        (maxStock == null || p.stock <= maxStock),
    );
  }

  /** Busca por nombre o SKU, sin distinguir mayúsculas ni tildes. */
  searchProducts(products: Product[], keyword: string): Product[] {
    const term = this.normalize(keyword);
    if (!term) {
      return products;
    }
    return products.filter(
      (p) => this.normalize(p.name).includes(term) || this.normalize(p.sku).includes(term),
    );
  }

  sortProducts(
    products: Product[],
    sortBy: ProductSortField = 'name',
    dir: 'asc' | 'desc' = 'asc',
  ): Product[] {
    const factor = dir === 'asc' ? 1 : -1;
    const value = (p: Product): string | number =>
      sortBy === 'category' ? p.category.name : p[sortBy];
    return [...products].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), environment.app.locale);
      return cmp * factor;
    });
  }

  isLowStock(product: Product): boolean {
    return product.stock < LOW_STOCK_THRESHOLD;
  }

  stockLevel(stock: number): StockLevel {
    if (stock <= 0) return 'out';
    if (stock < CRITICAL_STOCK_THRESHOLD) return 'critical';
    if (stock < LOW_STOCK_THRESHOLD) return 'low';
    return 'ok';
  }

  /** Margen sobre el precio de venta, entre 0 y 1 (0 si el precio no es positivo). */
  margin(price: number, cost: number): number {
    return price > 0 ? (price - cost) / price : 0;
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}
