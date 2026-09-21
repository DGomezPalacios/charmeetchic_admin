import { Injectable } from '@angular/core';

export type CsvCell = string | number | null | undefined;

/**
 * Exporta tablas a CSV. Usa ";" como separador y BOM UTF-8, que es lo que Excel espera
 * en configuraciones regionales en español (con "," abriría todo en una sola columna).
 */
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private static readonly SEPARATOR = ';';

  toCsv(headers: string[], rows: CsvCell[][]): string {
    const lines = [headers, ...rows].map((row) =>
      row.map((cell) => this.escape(cell)).join(CsvExportService.SEPARATOR),
    );
    return '﻿' + lines.join('\r\n');
  }

  download(filename: string, headers: string[], rows: CsvCell[][]): void {
    const blob = new Blob([this.toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escape(cell: CsvCell): string {
    if (cell === null || cell === undefined) {
      return '';
    }
    let text = String(cell);
    // Evita que Excel interprete texto del usuario como fórmula (CSV injection).
    if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
