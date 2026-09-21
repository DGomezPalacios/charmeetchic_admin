import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { startWith } from 'rxjs';
import { ProductImageDirective } from '../../../../../shared/directives/product-image.directive';
import { getErrorMessage } from '../../../../../shared/forms/form-errors';
import { Category } from '../../../../../shared/models/category.model';
import { Product, ProductDTO } from '../../../../../shared/models/product.model';
import { ApiService } from '../../../../../shared/services/api.service';
import { NotificationService } from '../../../../../shared/services/notification.service';
import { ProductService } from '../../../../../shared/services/product.service';

export interface ProductFormDialogData {
  /** Producto a editar; sin valor, el diálogo crea uno nuevo. */
  product?: Product;
  categories: Category[];
}

const MAX_IMAGES = 5;
/** URL absoluta, data URI de imagen o ruta relativa al backend (p. ej. /images/products/x.jpg). */
const IMAGE_URL_PATTERN = /^(https?:\/\/|data:image\/|\/)\S+$/i;

@Component({
  selector: 'app-product-form-dialog',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    ProductImageDirective,
  ],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.css',
})
export class ProductFormDialogComponent {
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);
  private readonly productLogic = inject(ProductService);
  private readonly dialogRef =
    inject<MatDialogRef<ProductFormDialogComponent, Product>>(MatDialogRef);
  protected readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.product;
  protected readonly saving = signal(false);
  protected readonly maxImages = MAX_IMAGES;
  protected readonly errorMessage = getErrorMessage;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(150)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100_000_000),
    ]),
    cost: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(100_000_000),
    ]),
    categoryId: new FormControl<number | null>(null, Validators.required),
    stock: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(1_000_000),
      Validators.pattern(/^\d+$/),
    ]),
    sku: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]{1,49}$/)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    images: new FormArray<FormControl<string>>([]),
  });

  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  /** Margen calculado con los valores actuales del formulario; `null` si aún no hay datos. */
  protected readonly margin = computed(() => {
    const { price, cost } = this.values();
    return price != null && cost != null && price > 0
      ? this.productLogic.margin(price, cost)
      : null;
  });

  constructor() {
    const product = this.data.product;
    if (product) {
      this.form.patchValue({
        name: product.name,
        description: product.description,
        price: product.price,
        cost: product.cost,
        categoryId: product.category.id,
        stock: product.stock,
        sku: product.sku,
        active: product.active,
      });
      product.images.forEach((url) => this.addImage(url));
    }
  }

  protected get images(): FormArray<FormControl<string>> {
    return this.form.controls.images;
  }

  protected addImage(url = ''): void {
    if (this.images.length >= MAX_IMAGES) {
      return;
    }
    this.images.push(
      new FormControl(url, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(500),
          Validators.pattern(IMAGE_URL_PATTERN),
        ],
      }),
    );
  }

  protected removeImage(index: number): void {
    this.images.removeAt(index);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const dto: ProductDTO = {
      name: raw.name.trim(),
      description: raw.description.trim(),
      price: raw.price as number,
      cost: raw.cost as number,
      categoryId: raw.categoryId as number,
      stock: raw.stock as number,
      sku: raw.sku.trim().toUpperCase(),
      images: raw.images.map((url) => url.trim()),
      active: raw.active,
      version: this.data.product?.version,
    };

    this.saving.set(true);
    const request = this.data.product
      ? this.api.updateProduct(this.data.product.id, dto)
      : this.api.createProduct(dto);
    request.subscribe({
      next: (saved) => {
        this.notifications.success(this.isEdit ? 'Producto actualizado.' : 'Producto creado.');
        this.dialogRef.close(saved);
      },
      // El mensaje de error ya lo muestra el interceptor (o ApiService en modo demo).
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
