import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PAGE_SIZE_OPTIONS } from '../../../../shared/constants';
import { Category } from '../../../../shared/models/category.model';
import { ApiService } from '../../../../shared/services/api.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PreferencesService } from '../../../../shared/services/preferences.service';
import {
  CategoryFormDialogComponent,
  CategoryFormDialogData,
} from './category-form-dialog/category-form-dialog.component';

@Component({
  selector: 'app-categories',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['name', 'description', 'actions'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly pageSize = inject(PreferencesService).pageSize();

  protected readonly dataSource = new MatTableDataSource<Category>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly filter = signal('');

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    this.dataSource.filterPredicate = (category, term) =>
      `${category.name} ${category.description}`.toLowerCase().includes(term);
    this.dataSource.sortingDataAccessor = (category, key) =>
      key === 'name' ? category.name.toLowerCase() : category.description.toLowerCase();

    effect(() => {
      this.dataSource.sort = this.sort() ?? null;
      this.dataSource.paginator = this.paginator() ?? null;
    });

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.dataSource.data = categories;
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected applyFilter(value: string): void {
    this.filter.set(value);
    this.dataSource.filter = value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  protected openForm(category?: Category): void {
    const data: CategoryFormDialogData = { category, existing: this.dataSource.data };
    this.dialog
      .open(CategoryFormDialogComponent, {
        data,
        width: '480px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  protected confirmDelete(category: Category): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Eliminar categoría',
          message: `¿Eliminar la categoría "${category.name}"? Solo es posible si no tiene productos asociados.`,
          confirmText: 'Eliminar',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.loading.set(true);
        this.api.deleteCategory(category.id).subscribe({
          next: () => {
            this.notifications.success(`Categoría "${category.name}" eliminada.`);
            this.load();
          },
          error: () => this.loading.set(false),
        });
      });
  }
}
