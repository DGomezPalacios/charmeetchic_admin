import { TestBed } from '@angular/core/testing';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';

function product(over: Partial<Product>): Product {
  return {
    id: 1,
    name: 'Producto',
    description: '',
    price: 10000,
    cost: 4000,
    category: { id: 1, name: 'Collares', description: '' },
    stock: 10,
    sku: 'SKU-1',
    images: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe('ProductService', () => {
  let service: ProductService;
  const catalog = [
    product({ id: 1, name: 'Collar Corazón', sku: 'COL-001', price: 25000, stock: 3 }),
    product({
      id: 2,
      name: 'Aretes Perla',
      sku: 'ARE-002',
      price: 12000,
      stock: 0,
      category: { id: 2, name: 'Aretes', description: '' },
    }),
    product({
      id: 3,
      name: 'Anillo Sello',
      sku: 'ANI-003',
      price: 35000,
      stock: 12,
      category: { id: 3, name: 'Anillos', description: '' },
    }),
  ];

  beforeEach(() => {
    service = TestBed.inject(ProductService);
  });

  it('formatPrice usa pesos chilenos sin decimales', () => {
    const text = service.formatPrice(24990).replace(/\s/g, ' ');
    expect(text).toContain('24.990');
    expect(text).toContain('$');
    expect(text).not.toContain(',');
  });

  it('buscar ignora mayúsculas y tildes, y encuentra por SKU', () => {
    expect(service.searchProducts(catalog, 'corazon').map((p) => p.id)).toEqual([1]);
    expect(service.searchProducts(catalog, 'ARE-002').map((p) => p.id)).toEqual([2]);
    expect(service.searchProducts(catalog, '  ')).toHaveLength(3);
    expect(service.searchProducts(catalog, 'zzz')).toHaveLength(0);
  });

  it('filtra por categoría, rango de precio y rango de stock (inclusivos)', () => {
    expect(service.filterProducts(catalog, { categoryId: 2 }).map((p) => p.id)).toEqual([2]);
    expect(
      service.filterProducts(catalog, { minPrice: 12000, maxPrice: 25000 }).map((p) => p.id),
    ).toEqual([1, 2]);
    expect(service.filterProducts(catalog, { maxStock: 4 }).map((p) => p.id)).toEqual([1, 2]);
    expect(service.filterProducts(catalog, { minStock: 5 }).map((p) => p.id)).toEqual([3]);
  });

  it('ordena por texto (con acentos) y por número, ascendente y descendente', () => {
    expect(service.sortProducts(catalog, 'name').map((p) => p.id)).toEqual([3, 2, 1]);
    expect(service.sortProducts(catalog, 'price', 'desc').map((p) => p.id)).toEqual([3, 1, 2]);
    expect(service.sortProducts(catalog, 'category').map((p) => p.category.name)).toEqual([
      'Anillos',
      'Aretes',
      'Collares',
    ]);
  });

  it('clasifica el nivel de stock', () => {
    expect(service.stockLevel(0)).toBe('out');
    expect(service.stockLevel(1)).toBe('critical');
    expect(service.stockLevel(4)).toBe('low');
    expect(service.stockLevel(5)).toBe('ok');
  });

  it('calcula el margen sobre el precio de venta', () => {
    expect(service.margin(10000, 4000)).toBeCloseTo(0.6);
    expect(service.margin(0, 100)).toBe(0);
    expect(service.margin(1000, 1500)).toBeLessThan(0);
  });
});
