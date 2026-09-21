import { Pipe, PipeTransform, inject } from '@angular/core';
import { ProductService } from '../services/product.service';

@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  private readonly products = inject(ProductService);

  transform(value: number | null | undefined): string {
    return this.products.formatPrice(value);
  }
}
