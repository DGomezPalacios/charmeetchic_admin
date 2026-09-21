import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { getErrorMessage } from '../../../../../shared/forms/form-errors';
import { Category } from '../../../../../shared/models/category.model';
import { ApiService } from '../../../../../shared/services/api.service';
import { NotificationService } from '../../../../../shared/services/notification.service';

export interface CategoryFormDialogData {
  /** Categoría a editar; sin valor, el diálogo crea una nueva. */
  category?: Category;
  /** Categorías existentes, para validar que el nombre sea único. */
  existing: Category[];
}

/** Rechaza nombres ya usados por otra categoría (sin distinguir mayúsculas ni espacios). */
export function uniqueCategoryName(existing: Category[], currentId?: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '')
      .trim()
      .toLowerCase();
    if (!value) {
      return null;
    }
    const taken = existing.some((c) => c.id !== currentId && c.name.trim().toLowerCase() === value);
    return taken ? { duplicate: true } : null;
  };
}

@Component({
  selector: 'app-category-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Editar categoría' : 'Nueva categoría' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field class="full">
          <mat-label>Nombre</mat-label>
          <input
            matInput
            formControlName="name"
            maxlength="60"
            autocomplete="off"
            cdkFocusInitial
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <mat-error>
              {{
                errorMessage(form.controls.name, {
                  duplicate: 'Ya existe una categoría con ese nombre.',
                })
              }}
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="255"></textarea>
          <mat-hint align="end">{{ form.controls.description.value.length }}/255</mat-hint>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="cancel()" [disabled]="saving()">Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear categoría' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
      min-width: min(420px, 80vw);
    }
  `,
})
export class CategoryFormDialogComponent {
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef =
    inject<MatDialogRef<CategoryFormDialogComponent, Category>>(MatDialogRef);
  private readonly data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.category;
  protected readonly saving = signal(false);
  protected readonly errorMessage = getErrorMessage;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.category?.name ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
        uniqueCategoryName(this.data.existing, this.data.category?.id),
      ],
    }),
    description: new FormControl(this.data.category?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    const dto = { name: name.trim(), description: description.trim() };

    this.saving.set(true);
    const request = this.data.category
      ? this.api.updateCategory(this.data.category.id, dto)
      : this.api.createCategory(dto);
    request.subscribe({
      next: (saved) => {
        this.notifications.success(this.isEdit ? 'Categoría actualizada.' : 'Categoría creada.');
        this.dialogRef.close(saved);
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
