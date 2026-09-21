import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Product, StockLevel } from '../../../../../shared/models/product.model';
import { ProductImageDirective } from '../../../../../shared/directives/product-image.directive';
import { PricePipe } from '../../../../../shared/pipes/price.pipe';
import { AuthService } from '../../../../../shared/services/auth.service';
import { ProductService } from '../../../../../shared/services/product.service';

/** Detalle de solo lectura. Se cierra con `'edit'` si el usuario pide editar el producto. */
@Component({
  selector: 'app-product-detail-dialog',
  imports: [
    DatePipe,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    PricePipe,
    ProductImageDirective,
  ],
  template: `
    <h2 mat-dialog-title>{{ product.name }}</h2>
    <mat-dialog-content>
      @if (product.images.length > 0) {
        <div class="gallery">
          <img class="main" [appProductImage]="product.images[selected()]" [alt]="product.name" />
          @if (product.images.length > 1) {
            <div class="thumbs">
              @for (image of product.images; track $index) {
                <button
                  type="button"
                  [class.on]="$index === selected()"
                  [attr.aria-label]="'Ver imagen ' + ($index + 1)"
                  (click)="selected.set($index)"
                >
                  <img [appProductImage]="image" alt="" />
                </button>
              }
            </div>
          }
        </div>
      }

      <p class="description">{{ product.description || 'Sin descripción.' }}</p>

      <dl>
        <div>
          <dt>SKU</dt>
          <dd>{{ product.sku }}</dd>
        </div>
        <div>
          <dt>Categoría</dt>
          <dd>{{ product.category.name }}</dd>
        </div>
        <div>
          <dt>Precio de venta</dt>
          <dd>{{ product.price | price }}</dd>
        </div>
        <div>
          <dt>Costo</dt>
          <dd>{{ product.cost | price }}</dd>
        </div>
        <div>
          <dt>Margen</dt>
          <dd>{{ margin * 100 | number: '1.0-1' }}%</dd>
        </div>
        <div>
          <dt>Stock</dt>
          <dd>
            <span class="chip" [class]="'chip chip-' + level">
              <mat-icon aria-hidden="true">{{ icons[level] }}</mat-icon>
              {{ product.stock }} · {{ labels[level] }}
            </span>
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ product.active ? 'Activo' : 'Inactivo' }}</dd>
        </div>
        <div>
          <dt>Creado</dt>
          <dd>{{ product.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>{{ product.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cerrar</button>
      @if (canEdit()) {
        <button mat-flat-button type="button" [mat-dialog-close]="'edit'">
          <mat-icon>edit</mat-icon>
          Editar
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .gallery {
      margin-bottom: 16px;
    }
    .main {
      display: block;
      width: 100%;
      max-height: 260px;
      object-fit: contain;
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
    }
    .thumbs {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .thumbs button {
      padding: 0;
      border: 2px solid transparent;
      border-radius: 8px;
      background: none;
      cursor: pointer;
    }
    .thumbs button.on {
      border-color: var(--mat-sys-primary);
    }
    .thumbs img {
      display: block;
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
    }
    .description {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    dl {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
      margin: 0;
    }
    dt {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
      font-weight: 500;
    }
  `,
})
export class ProductDetailDialogComponent {
  protected readonly product = inject<Product>(MAT_DIALOG_DATA);
  private readonly productLogic = inject(ProductService);
  private readonly auth = inject(AuthService);

  /** Solo el administrador puede pasar del detalle a la edición. */
  protected readonly canEdit = computed(() => this.auth.isAdmin());
  protected readonly selected = signal(0);
  protected readonly margin = this.productLogic.margin(this.product.price, this.product.cost);
  protected readonly level: StockLevel = this.productLogic.stockLevel(this.product.stock);

  protected readonly labels: Record<StockLevel, string> = {
    out: 'Agotado',
    critical: 'Crítico',
    low: 'Bajo',
    ok: 'Suficiente',
  };
  protected readonly icons: Record<StockLevel, string> = {
    out: 'error',
    critical: 'priority_high',
    low: 'warning',
    ok: 'check_circle',
  };
}
