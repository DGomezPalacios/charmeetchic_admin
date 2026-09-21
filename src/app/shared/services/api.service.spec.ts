import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiError } from '../models/api-error';
import { ProductResponse } from './api-mappers';
import { ApiService } from './api.service';

const API = 'http://localhost:8080/api';

/** Forma real de un producto en `charmeetchic_api` (capturada del backend). */
function productJson(over: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 7,
    name: 'Anillo Solitario Circón',
    description: 'Anillo solitario con circón en plata 925',
    price: 21990.0,
    cost: 9000.0,
    sku: 'ANI-SOL-001',
    stock: 15,
    categoryId: 3,
    categoryName: 'Anillos',
    images: ['/images/products/anillo-solitario.jpg'],
    active: true,
    createdAt: '2026-09-20T21:13:07.778011',
    updatedAt: '2026-09-20T21:13:07.778011',
    version: 0,
    ...over,
  };
}

function pageJson(
  content: ProductResponse[],
  number = 0,
  totalPages = 1,
  totalElements = content.length,
) {
  return { content, number, totalPages, totalElements, size: 10 };
}

describe('ApiService (contrato de charmeetchic_api)', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Sesión real (no la de desarrollo): las llamadas van al backend, no al simulado.
        { provide: AuthService, useValue: { isDevSession: () => false } },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('productos', () => {
    it('traduce el producto plano del backend al modelo con categoría anidada', async () => {
      const result = firstValueFrom(api.getProducts(0, 10, { sortBy: 'name', sortDir: 'asc' }));
      const req = http.expectOne((r) => r.url === `${API}/products`);
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.params.get('sort')).toBe('name,asc');
      req.flush(pageJson([productJson()]));

      const page = await result;
      const product = page.content[0];
      expect(product.category).toEqual({ id: 3, name: 'Anillos', description: '' });
      expect(product.version).toBe(0);
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.images).toEqual(['/images/products/anillo-solitario.jpg']);
      expect(page.totalElements).toBe(1);
    });

    it('filtra por categoría con /products/search?category=', () => {
      api.getProducts(1, 10, { categoryId: 3 }).subscribe();
      const req = http.expectOne((r) => r.url === `${API}/products/search`);
      expect(req.request.params.get('category')).toBe('3');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageJson([]));
    });

    it('ordena por categoría con la propiedad anidada category.name', () => {
      api.getProducts(0, 10, { sortBy: 'category', sortDir: 'desc' }).subscribe();
      const req = http.expectOne((r) => r.url === `${API}/products`);
      expect(req.request.params.get('sort')).toBe('category.name,desc');
      req.flush(pageJson([]));
    });

    it('no pide más de 100 por página (límite del backend)', () => {
      api.getProducts(0, 500).subscribe();
      const req = http.expectOne((r) => r.url === `${API}/products`);
      expect(req.request.params.get('size')).toBe('100');
      req.flush(pageJson([]));
    });

    it('busca por SKU en el cliente: trae todas las páginas y filtra localmente', async () => {
      const result = firstValueFrom(api.getProducts(0, 10, {}, 'ani-sol'));

      const first = http.expectOne(
        (r) => r.url === `${API}/products` && r.params.get('page') === '0',
      );
      expect(first.request.params.get('size')).toBe('100');
      first.flush(pageJson([productJson({ id: 1, sku: 'COL-001', name: 'Collar Luna' })], 0, 2, 2));

      const second = http.expectOne(
        (r) => r.url === `${API}/products` && r.params.get('page') === '1',
      );
      second.flush(pageJson([productJson({ id: 2 })], 1, 2, 2));

      const page = await result;
      expect(page.totalElements).toBe(1);
      expect(page.content[0].sku).toBe('ANI-SOL-001');
    });

    it('el filtro de precio (que el backend no tiene) también se aplica en el cliente', async () => {
      const result = firstValueFrom(api.getProducts(0, 10, { minPrice: 20000 }));
      http
        .expectOne((r) => r.url === `${API}/products`)
        .flush(
          pageJson([
            productJson({ id: 1, price: 10000, sku: 'A-1' }),
            productJson({ id: 2, price: 25000, sku: 'B-2' }),
          ]),
        );
      const page = await result;
      expect(page.content.map((p) => p.id)).toEqual([2]);
    });

    it('al editar envía la versión para el bloqueo optimista (PUT)', () => {
      api
        .updateProduct(7, {
          name: 'X',
          description: '',
          price: 1,
          cost: 1,
          categoryId: 3,
          stock: 1,
          sku: 'X-1',
          images: [],
          active: true,
          version: 4,
        })
        .subscribe();
      const req = http.expectOne(`${API}/products/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.version).toBe(4);
      req.flush(productJson({ version: 5 }));
    });

    it('lee el stock bajo desde /products/low-stock', async () => {
      const result = firstValueFrom(api.getLowStockProducts());
      http.expectOne(`${API}/products/low-stock`).flush([productJson({ stock: 1 })]);
      expect((await result)[0].stock).toBe(1);
    });
  });

  describe('órdenes', () => {
    it('cambia el estado con PUT (CORS del backend no permite PATCH)', () => {
      api.updateOrderStatus(1001, 'PROCESSING').subscribe();
      const req = http.expectOne(`${API}/orders/1001/status`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ status: 'PROCESSING' });
      req.flush({
        id: 1001,
        userId: 'u',
        items: [],
        subtotal: 100,
        tax: 19,
        total: 119,
        status: 'PROCESSING',
        createdAt: '2026-09-20T10:00:00',
      });
    });
  });

  describe('reportes', () => {
    const range = { from: new Date(2026, 8, 1), to: new Date(2026, 8, 20) };

    it('ventas por categoría: usa /reports/sales-by-category y mapea revenue → amount', async () => {
      const result = firstValueFrom(api.getReports('BY_CATEGORY', range));
      const req = http.expectOne((r) => r.url === `${API}/reports/sales-by-category`);
      expect(req.request.params.get('from')).toBe('2026-09-01');
      expect(req.request.params.get('to')).toBe('2026-09-20');
      req.flush([{ category: 'Anillos', unitsSold: 4, revenue: 80000 }]);

      const report = await result;
      expect(report.salesByCategory).toEqual([{ category: 'Anillos', amount: 80000, units: 4 }]);
      expect(report.totalSales).toBe(80000);
    });

    it('productos más vendidos: usa /reports/top-products', async () => {
      const result = firstValueFrom(api.getReports('TOP_PRODUCTS', range));
      http
        .expectOne((r) => r.url === `${API}/reports/top-products`)
        .flush([{ productId: 1, name: 'Collar', sku: 'C-1', unitsSold: 9, revenue: 90000 }]);
      expect((await result).topProducts[0]).toEqual({
        name: 'Collar',
        sold: 9,
        sku: 'C-1',
        revenue: 90000,
      });
    });

    it('total de ventas: usa /reports/sales y conserva el resumen', async () => {
      const result = firstValueFrom(api.getReports('TOTAL_SALES', range));
      http
        .expectOne((r) => r.url === `${API}/reports/sales`)
        .flush({
          range: { from: '2026-09-01', to: '2026-09-20' },
          orderCount: 3,
          subtotal: 100000,
          tax: 19000,
          totalSales: 119000,
          averageOrderValue: 39667,
        });
      const report = await result;
      expect(report.totalSales).toBe(119000);
      expect(report.summary?.orderCount).toBe(3);
    });

    it('ventas por día: una consulta /reports/sales por cada día', async () => {
      const result = firstValueFrom(api.getSalesByDay(3));
      const requests = http.match((r) => r.url === `${API}/reports/sales`);
      expect(requests).toHaveLength(3);
      for (const req of requests) {
        expect(req.request.params.get('from')).toBe(req.request.params.get('to'));
        req.flush({
          orderCount: 1,
          subtotal: 1,
          tax: 0,
          totalSales: 1000,
          averageOrderValue: 1000,
        });
      }
      const days = await result;
      expect(days.map((d) => d.amount)).toEqual([1000, 1000, 1000]);
      expect(days[0].date.getTime()).toBeLessThan(days[2].date.getTime());
    });
  });

  describe('errores', () => {
    it('traduce el ApiError del backend (con fieldErrors) a un mensaje legible', async () => {
      const result = firstValueFrom(api.createProduct({} as never)).catch((e: unknown) => e);
      http.expectOne(`${API}/products`).flush(
        {
          status: 400,
          message: 'Datos de entrada inválidos',
          fieldErrors: { sku: 'El SKU es obligatorio' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      const error = (await result) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(error.message).toContain('Datos de entrada inválidos');
      expect(error.message).toContain('sku: El SKU es obligatorio');
    });

    it('si el backend no responde, pasa a modo demostración con datos de ejemplo', async () => {
      const result = firstValueFrom(api.getCategories());
      http.expectOne(`${API}/categories`).error(new ProgressEvent('error'), { status: 0 });
      const categories = await result;
      expect(api.demoMode()).toBe('unreachable');
      expect(categories.length).toBeGreaterThan(0);
    });

    it('un 401 no activa el modo demostración (es un problema de autenticación)', async () => {
      const result = firstValueFrom(api.getCategories()).catch((e: unknown) => e);
      http
        .expectOne(`${API}/categories`)
        .flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });
      expect(await result).toBeInstanceOf(ApiError);
      expect(api.demoMode()).toBeNull();
    });
  });
});
