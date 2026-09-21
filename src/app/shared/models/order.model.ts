export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'DELIVERED';

export interface Order {
  id: number;
  userId: string;
  items: OrderItem[];
  /** Total con IVA. */
  total: number;
  subtotal: number;
  tax: number;
  status: OrderStatus;
  shippingAddress?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  /** Precio unitario congelado al momento de la compra. */
  price: number;
  subtotal: number;
}

/** Ciclo de vida en orden: una orden solo puede avanzar al estado siguiente. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'DELIVERED',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En proceso',
  SENT: 'Enviada',
  DELIVERED: 'Entregada',
};

/** Estado al que puede pasar la orden; `null` si ya está en el estado final. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return ORDER_STATUSES[ORDER_STATUSES.indexOf(status) + 1] ?? null;
}
