import { Category } from '../models/category.model';
import { Order, OrderItem, OrderStatus } from '../models/order.model';
import { Page, Product } from '../models/product.model';
import { InventoryValue, SalesSummary } from '../models/report.model';

/**
 * Formas JSON que devuelve el backend (`charmeetchic_api`) y su traducción al modelo del panel.
 * Los importes `BigDecimal` llegan como números; las fechas `LocalDateTime` como texto sin zona horaria.
 */

export interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  sku: string;
  stock: number;
  categoryId: number;
  categoryName: string;
  images: string[] | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CategoryResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt?: string;
}

export interface OrderResponse {
  id: number;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  shippingAddress?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface SalesSummaryResponse extends SalesSummary {
  range: { from: string; to: string };
}

export type InventoryValueResponse = InventoryValue;

export interface CategorySalesResponse {
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface TopProductResponse {
  productId: number;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
}

export interface ProfileResponse {
  userId: string;
  email: string;
  name: string;
  roles: string[];
}

export function toCategory(r: CategoryResponse): Category {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

export function toProduct(r: ProductResponse): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    price: r.price,
    cost: r.cost,
    category: { id: r.categoryId, name: r.categoryName, description: '' },
    stock: r.stock,
    sku: r.sku,
    images: r.images ?? [],
    active: r.active,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    version: r.version,
  };
}

export function toProductPage(page: Page<ProductResponse>): Page<Product> {
  return { ...page, content: page.content.map(toProduct) };
}

export function toOrder(r: OrderResponse): Order {
  return {
    id: r.id,
    userId: r.userId,
    items: r.items,
    subtotal: r.subtotal,
    tax: r.tax,
    total: r.total,
    status: r.status,
    shippingAddress: r.shippingAddress ?? undefined,
    createdAt: new Date(r.createdAt),
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
  };
}
