import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Indicador de carga. Con `overlay` cubre el contenedor padre (que debe ser `position: relative`). */
@Component({
  selector: 'app-loading-spinner',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="spinner" [class.overlay]="overlay()" role="status" aria-live="polite">
      <mat-spinner [diameter]="diameter()" />
      <span [class.sr-only]="!label()">{{ label() || 'Cargando…' }}</span>
    </div>
  `,
  styles: `
    .spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 32px 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      padding: 0;
      background: color-mix(in srgb, var(--mat-sys-surface) 72%, transparent);
    }
  `,
})
export class LoadingSpinnerComponent {
  readonly overlay = input(false);
  readonly label = input('');
  readonly diameter = input(40);
}
