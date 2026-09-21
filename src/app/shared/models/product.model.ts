import { Category } from './category.model';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  category: Category;
  stock: number;
  sku: string;
  images: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Versión para control de concurrencia optimista (el backend la incrementa en cada cambio). */
  version?: number;
}

/** Cuerpo de crear/editar producto: la categoría viaja como id. */
export interface ProductDTO {
  name: string;
  description: string;
  price: number;
  cost: number;
  categoryId: number;
  stock: number;
  sku: string;
  images: string[];
  active: boolean;
  /** Solo al editar: si otro usuario modificó el producto mientras tanto, el backend responde 409. */
  version?: number;
}

export interface ProductFilter {
  categoryId?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  /** Stock mínimo (inclusive). */
  minStock?: number | null;
  /** Stock máximo (inclusive). */
  maxStock?: number | null;
  sortBy?: ProductSortField;
  sortDir?: 'asc' | 'desc';
}

export type ProductSortField = 'name' | 'sku' | 'price' | 'stock' | 'category';

/** Respuesta paginada (mismo formato que Spring Data `Page`). */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** Índice de página, base 0. */
  number: number;
  size: number;
}

export type StockLevel = 'out' | 'critical' | 'low' | 'ok';
