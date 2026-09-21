import { Component, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { environment } from '../../../../environments/environment';
import { PreferencesService } from '../../services/preferences.service';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
);

/**
 * Gráfico de una sola serie (barras o línea) con Chart.js.
 * Sin leyenda: el título de la tarjeta que lo contiene nombra la serie.
 * Incluye una tabla oculta visualmente con los mismos datos para lectores de pantalla.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div class="chart-box" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
    <table class="sr-only">
      <caption>
        {{
          ariaLabel()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Categoría</th>
          <th scope="col">{{ seriesLabel() }}</th>
        </tr>
      </thead>
      <tbody>
        @for (label of labels(); track $index) {
          <tr>
            <th scope="row">{{ label }}</th>
            <td>{{ format()(values()[$index]) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
    }
    .chart-box {
      position: relative;
      width: 100%;
    }
  `,
})
export class ChartComponent {
  readonly type = input<'bar' | 'line'>('bar');
  /** Barras horizontales: útil con nombres de categoría largos. */
  readonly horizontal = input(false);
  readonly labels = input.required<string[]>();
  readonly values = input.required<number[]>();
  readonly seriesLabel = input('Valor');
  readonly ariaLabel = input('Gráfico');
  readonly height = input(260);
  /** Formato completo para el tooltip y la tabla accesible. */
  readonly format = input<(value: number) => string>((value) =>
    value.toLocaleString(environment.app.locale),
  );

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly preferences = inject(PreferencesService);

  constructor() {
    afterRenderEffect((onCleanup) => {
      this.preferences.theme(); // recrea el gráfico al cambiar de tema para releer los colores
      const chart = new Chart(this.canvas().nativeElement, this.buildConfig());
      onCleanup(() => chart.destroy());
    });
  }

  private buildConfig(): ChartConfiguration {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const mark = token('--cce-chart-mark');
    const surface = token('--mat-sys-surface-container-lowest');
    const grid = token('--cce-chart-grid');
    const text = token('--mat-sys-on-surface-variant');
    const format = this.format();
    const horizontal = this.horizontal();
    const isLine = this.type() === 'line';
    const compact = new Intl.NumberFormat(environment.app.locale, { notation: 'compact' });
    const valueAxis = horizontal ? 'x' : 'y';
    // Con valores enteros (unidades, pesos) los ticks no deben caer en decimales.
    const precision = this.values().every(Number.isInteger) ? 0 : undefined;

    const dataset = isLine
      ? {
          data: this.values(),
          borderColor: mark,
          borderWidth: 2,
          borderJoinStyle: 'round' as const,
          borderCapStyle: 'round' as const,
          backgroundColor: `color-mix(in srgb, ${mark} 10%, transparent)`,
          fill: true,
          tension: 0,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: mark,
          pointBorderColor: surface,
          pointBorderWidth: 2,
          pointHitRadius: 24,
        }
      : {
          data: this.values(),
          backgroundColor: mark,
          hoverBackgroundColor: `color-mix(in srgb, ${mark} 82%, white)`,
          maxBarThickness: 24,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
          borderRadius: horizontal ? { topRight: 4, bottomRight: 4 } : { topLeft: 4, topRight: 4 },
          borderSkipped: 'start' as const,
        };

    return {
      type: isLine ? 'line' : 'bar',
      data: { labels: this.labels(), datasets: [dataset] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (context) => format(context.parsed[valueAxis] as number),
            },
          },
        },
        scales: {
          x: {
            border: { display: false },
            grid: { color: horizontal ? grid : 'transparent', lineWidth: 1 },
            ticks: {
              color: text,
              autoSkip: false,
              precision: horizontal ? precision : undefined,
              ...(horizontal ? { callback: (v) => compact.format(Number(v)) } : {}),
            },
            beginAtZero: true,
          },
          y: {
            border: { display: false },
            grid: { color: horizontal ? 'transparent' : grid, lineWidth: 1 },
            ticks: {
              color: text,
              autoSkip: false,
              precision: horizontal ? undefined : precision,
              ...(horizontal ? {} : { callback: (v) => compact.format(Number(v)) }),
            },
            beginAtZero: true,
          },
        },
      },
    } as ChartConfiguration;
  }
}
