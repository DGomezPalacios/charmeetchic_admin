import { Category } from '../models/category.model';
import { Order, OrderItem, OrderStatus } from '../models/order.model';
import { Product } from '../models/product.model';

/** IVA que aplica el backend sobre el subtotal (`app.order.tax-rate`). */
export const MOCK_TAX_RATE = 0.19;

/** Imagen de marcador (SVG embebido) para no depender de recursos externos. */
export function placeholderImage(label: string, hue = 42): string {
  const initial = (label.trim()[0] ?? '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},55%,82%)"/><stop offset="1" stop-color="hsl(${hue},45%,58%)"/>` +
    `</linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>` +
    `<text x="200" y="240" font-family="Georgia,serif" font-size="140" text-anchor="middle" fill="rgba(255,255,255,.85)">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Collares', description: 'Collares, cadenas y gargantillas.' },
  { id: 2, name: 'Aretes', description: 'Aros, argollas y aretes colgantes.' },
  { id: 3, name: 'Pulseras', description: 'Pulseras, brazaletes y tobilleras.' },
  { id: 4, name: 'Anillos', description: 'Anillos simples, con piedras y sets.' },
  { id: 5, name: 'Relojes', description: 'Relojes de moda para dama y caballero.' },
  { id: 6, name: 'Accesorios', description: 'Estuches, cintillos y otros complementos.' },
];

type Seed = [name: string, categoryId: number, price: number, cost: number, stock: number];

const PRODUCT_SEEDS: Seed[] = [
  ['Collar Luna Dorado', 1, 24990, 9800, 18],
  ['Collar Perla Barroca', 1, 32990, 14500, 3],
  ['Gargantilla Cadena Fina', 1, 19990, 7200, 26],
  ['Collar Corazón Plata 925', 1, 27990, 12000, 1],
  ['Aros Argolla Oro Laminado', 2, 14990, 5200, 42],
  ['Aretes Gota Cristal', 2, 12990, 4600, 4],
  ['Aros Trepadores Plata', 2, 16990, 6100, 15],
  ['Aretes Perla Clásicos', 2, 11990, 3900, 0],
  ['Pulsera Eslabones Dorada', 3, 21990, 8400, 22],
  ['Brazalete Rígido Acero', 3, 25990, 10300, 9],
  ['Pulsera Dijes Charm', 3, 29990, 12800, 2],
  ['Tobillera Bolitas Plata', 3, 9990, 3200, 31],
  ['Anillo Solitario Circón', 4, 18990, 6900, 12],
  ['Set 3 Anillos Minimal', 4, 15990, 5300, 4],
  ['Anillo Sello Plata 925', 4, 34990, 15600, 7],
  ['Anillo Ajustable Flor', 4, 8990, 2800, 0],
  ['Reloj Clásico Correa Cuero', 5, 59990, 27500, 6],
  ['Reloj Minimal Malla Dorada', 5, 69990, 32100, 3],
  ['Reloj Sport Unisex', 5, 49990, 22400, 11],
  ['Estuche Joyero Terciopelo', 6, 17990, 7300, 14],
  ['Cintillo Perlas', 6, 10990, 3700, 19],
  ['Paño Limpiador de Plata', 6, 3990, 900, 60],
  ['Broche Camelia Esmaltado', 6, 7990, 2500, 8],
  ['Organizador de Aros Acrílico', 6, 12990, 4800, 1],
];

export function buildMockProducts(now = new Date()): Product[] {
  return PRODUCT_SEEDS.map(([name, categoryId, price, cost, stock], index) => {
    const category = MOCK_CATEGORIES.find((c) => c.id === categoryId) as Category;
    const created = new Date(now.getTime() - (90 - index * 3) * 86_400_000);
    return {
      id: index + 1,
      name,
      description: `${name}. Pieza de la colección ${category.name.toLowerCase()} de Charme et Chic.`,
      price,
      cost,
      category,
      stock,
      sku: `${category.name.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(4, '0')}`,
      images: [placeholderImage(name, 36 + categoryId * 9)],
      active: true,
      createdAt: created,
      updatedAt: created,
      version: 0,
    };
  });
}

const ORDER_SEEDS: {
  daysAgo: number;
  status: OrderStatus;
  lines: [productId: number, qty: number][];
}[] = [
  {
    daysAgo: 0,
    status: 'PENDING',
    lines: [
      [1, 1],
      [5, 2],
    ],
  },
  { daysAgo: 0, status: 'PENDING', lines: [[17, 1]] },
  {
    daysAgo: 1,
    status: 'PROCESSING',
    lines: [
      [9, 1],
      [13, 1],
      [21, 2],
    ],
  },
  { daysAgo: 1, status: 'PENDING', lines: [[3, 1]] },
  { daysAgo: 2, status: 'PROCESSING', lines: [[18, 1]] },
  {
    daysAgo: 3,
    status: 'SENT',
    lines: [
      [7, 2],
      [12, 1],
    ],
  },
  { daysAgo: 3, status: 'SENT', lines: [[15, 1]] },
  {
    daysAgo: 4,
    status: 'DELIVERED',
    lines: [
      [2, 1],
      [6, 1],
    ],
  },
  { daysAgo: 5, status: 'DELIVERED', lines: [[19, 1]] },
  {
    daysAgo: 5,
    status: 'DELIVERED',
    lines: [
      [10, 1],
      [22, 3],
    ],
  },
  {
    daysAgo: 6,
    status: 'DELIVERED',
    lines: [
      [1, 2],
      [9, 1],
    ],
  },
  { daysAgo: 6, status: 'DELIVERED', lines: [[14, 2]] },
  {
    daysAgo: 9,
    status: 'DELIVERED',
    lines: [
      [17, 1],
      [20, 1],
    ],
  },
  {
    daysAgo: 12,
    status: 'DELIVERED',
    lines: [
      [5, 3],
      [11, 1],
    ],
  },
];

export function buildMockOrders(products: Product[], now = new Date()): Order[] {
  return ORDER_SEEDS.map((seed, index) => {
    const items: OrderItem[] = seed.lines.map(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId) as Product;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity,
        price: product.price,
        subtotal: product.price * quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = Math.round(subtotal * MOCK_TAX_RATE);
    const createdAt = new Date(now.getTime() - seed.daysAgo * 86_400_000 - index * 47 * 60_000);
    return {
      id: 1001 + index,
      userId: `cliente${index + 1}@correo.cl`,
      items,
      subtotal,
      tax,
      total: subtotal + tax,
      status: seed.status,
      shippingAddress: 'Av. Providencia 1234, Santiago',
      createdAt,
      updatedAt: createdAt,
    };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
