import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { Order, ORDER_STATUS_LABELS } from '../../../../../shared/models/order.model';
import { PricePipe } from '../../../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-order-detail-dialog',
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatTableModule, PricePipe],
  template: `
    <h2 mat-dialog-title>Orden #{{ order.id }}</h2>
    <mat-dialog-content>
      <dl class="meta">
        <div>
          <dt>Fecha</dt>
          <dd>{{ order.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{{ order.userId }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span class="chip" [class]="'chip chip-' + order.status">{{
              statusLabels[order.status]
            }}</span>
          </dd>
        </div>
        @if (order.shippingAddress) {
          <div class="wide">
            <dt>Dirección de envío</dt>
            <dd>{{ order.shippingAddress }}</dd>
          </div>
        }
      </dl>

      <div class="table-scroll">
        <table mat-table [dataSource]="order.items">
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef>Producto</th>
            <td mat-cell *matCellDef="let item">
              <div class="name">{{ item.productName }}</div>
              <div class="muted sku">{{ item.sku }}</div>
            </td>
            <td mat-footer-cell *matFooterCellDef colspan="3" class="num">Subtotal</td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef class="num">Cant.</th>
            <td mat-cell *matCellDef="let item" class="num">{{ item.quantity }}</td>
          </ng-container>
          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef class="num">Precio</th>
            <td mat-cell *matCellDef="let item" class="num">{{ item.price | price }}</td>
          </ng-container>
          <ng-container matColumnDef="subtotal">
            <th mat-header-cell *matHeaderCellDef class="num">Subtotal</th>
            <td mat-cell *matCellDef="let item" class="num">{{ item.subtotal | price }}</td>
            <td mat-footer-cell *matFooterCellDef class="num">{{ order.subtotal | price }}</td>
          </ng-container>
          <ng-container matColumnDef="taxLabel">
            <td mat-footer-cell *matFooterCellDef colspan="3" class="num">IVA</td>
          </ng-container>
          <ng-container matColumnDef="tax">
            <td mat-footer-cell *matFooterCellDef class="num">{{ order.tax | price }}</td>
          </ng-container>
          <ng-container matColumnDef="totalLabel">
            <td mat-footer-cell *matFooterCellDef colspan="3" class="num">
              <strong>Total</strong>
            </td>
          </ng-container>
          <ng-container matColumnDef="total">
            <td mat-footer-cell *matFooterCellDef class="num">
              <strong>{{ order.total | price }}</strong>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
          <tr mat-footer-row *matFooterRowDef="['product', 'subtotal']"></tr>
          <tr mat-footer-row *matFooterRowDef="['taxLabel', 'tax']"></tr>
          <tr mat-footer-row *matFooterRowDef="['totalLabel', 'total']"></tr>
        </table>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px 16px;
      margin: 0 0 16px;
    }
    .meta .wide {
      grid-column: 1 / -1;
    }
    dt {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
      font-weight: 500;
    }
    .sku {
      font-size: 12px;
    }
    .table-scroll table {
      min-width: 480px;
    }
  `,
})
export class OrderDetailDialogComponent {
  protected readonly order = inject<Order>(MAT_DIALOG_DATA);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly columns = ['product', 'quantity', 'price', 'subtotal'];
}
