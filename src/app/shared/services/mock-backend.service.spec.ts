import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../models/api-error';
import { ProductDTO } from '../models/product.model';
import { MockBackendService } from './mock-backend.service';

const dto = (over: Partial<ProductDTO> = {}): ProductDTO => ({
  name: 'Producto QA',
  description: '',
  price: 1000,
  cost: 400,
  categoryId: 1,
  stock: 10,
  sku: 'qa-001',
  images: [],
  active: true,
  ...over,
});

describe('MockBackendService (mismas reglas que el backend real)', () => {
  let mock: MockBackendService;

  beforeEach(() => {
    mock = TestBed.inject(MockBackendService);
    mock.latencyMs = 0;
  });

  it('normaliza el SKU a mayúsculas y rechaza duplicados', async () => {
    const created = await firstValueFrom(mock.createProduct(dto()));
    expect(created.sku).toBe('QA-001');
    await expect(
      firstValueFrom(mock.createProduct(dto({ sku: ' QA-001 ' }))),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('el borrado es lógico: el producto deja de listarse y de consultarse', async () => {
    const before = await firstValueFrom(mock.getProducts(0, 100, {}, ''));
    await firstValueFrom(mock.deleteProduct(1));

    const after = await firstValueFrom(mock.getProducts(0, 100, {}, ''));
    expect(after.totalElements).toBe(before.totalElements - 1);
    await expect(firstValueFrom(mock.getProductById(1))).rejects.toMatchObject({ status: 404 });
  });

  it('bloqueo optimista: editar con una versión vieja responde 409', async () => {
    const created = await firstValueFrom(mock.createProduct(dto()));
    const updated = await firstValueFrom(
      mock.updateProduct(created.id, dto({ name: 'Nuevo', version: created.version })),
    );
    expect(updated.version).toBe((created.version ?? 0) + 1);

    await expect(
      firstValueFrom(mock.updateProduct(created.id, dto({ version: created.version }))),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('las órdenes solo avanzan al estado inmediatamente siguiente', async () => {
    const orders = await firstValueFrom(mock.getOrders());
    const pending = orders.find((o) => o.status === 'PENDING');
    expect(pending).toBeDefined();

    // Saltarse un estado es inválido…
    await expect(
      firstValueFrom(mock.updateOrderStatus(pending!.id, 'SENT')),
    ).rejects.toBeInstanceOf(ApiError);
    // …avanzar al siguiente, no.
    const advanced = await firstValueFrom(mock.updateOrderStatus(pending!.id, 'PROCESSING'));
    expect(advanced.status).toBe('PROCESSING');
  });

  it('una orden entregada no admite más cambios', async () => {
    const delivered = (await firstValueFrom(mock.getOrders())).find(
      (o) => o.status === 'DELIVERED',
    );
    await expect(
      firstValueFrom(mock.updateOrderStatus(delivered!.id, 'PENDING')),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('no permite eliminar una categoría con productos', async () => {
    await expect(firstValueFrom(mock.deleteCategory(1))).rejects.toMatchObject({ status: 409 });
  });

  it('stock bajo: solo productos activos con menos de 5 unidades, del menor al mayor', async () => {
    const low = await firstValueFrom(mock.getLowStockProducts());
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((p) => p.stock < 5 && p.active)).toBe(true);
    expect(low.map((p) => p.stock)).toEqual([...low.map((p) => p.stock)].sort((a, b) => a - b));
  });

  it('el reporte de ventas suma subtotal + IVA', async () => {
    const range = { from: new Date(Date.now() - 30 * 86_400_000), to: new Date() };
    const report = await firstValueFrom(mock.getReports('TOTAL_SALES', range));
    expect(report.summary).toBeDefined();
    expect(report.summary!.totalSales).toBe(report.summary!.subtotal + report.summary!.tax);
  });
});
