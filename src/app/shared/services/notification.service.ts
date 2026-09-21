import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'cce-snack-success', 3500);
  }

  error(message: string): void {
    this.open(message, 'cce-snack-error', 6000);
  }

  info(message: string): void {
    this.open(message, 'cce-snack-info', 4000);
  }

  private open(message: string, panelClass: string, duration: number): void {
    this.snackBar.open(message, 'Cerrar', {
      duration,
      panelClass,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }
}
