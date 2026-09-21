import { TestBed } from '@angular/core/testing';
import { CsvExportService } from './csv-export.service';

describe('CsvExportService', () => {
  let csv: CsvExportService;

  beforeEach(() => {
    csv = TestBed.inject(CsvExportService);
  });

  it('usa BOM UTF-8, separador ";" y saltos CRLF (Excel en español)', () => {
    const out = csv.toCsv(['Categoría', 'Ventas'], [['Anillos', 80000]]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.slice(1)).toBe('Categoría;Ventas\r\nAnillos;80000');
  });

  it('entrecomilla celdas con separador, comillas o saltos de línea', () => {
    const out = csv.toCsv(['a'], [['x;y'], ['di "hola"'], ['línea1\nlínea2']]);
    expect(out).toContain('"x;y"');
    expect(out).toContain('"di ""hola"""');
    expect(out).toContain('"línea1\nlínea2"');
  });

  it('neutraliza texto que Excel interpretaría como fórmula (CSV injection)', () => {
    const out = csv.toCsv(['n'], [['=HYPERLINK("http://x")'], ['+cmd'], ['-1+1'], ['@SUM(A1)']]);
    const lines = out.split('\r\n').slice(1);
    expect(lines.every((l) => l.replace(/^"/, '').startsWith("'"))).toBe(true);
  });

  it('no altera números negativos ni valores vacíos', () => {
    const out = csv.toCsv(
      ['n', 'm'],
      [
        [-5, null],
        [undefined, 0],
      ],
    );
    expect(out.split('\r\n').slice(1)).toEqual(['-5;', ';0']);
  });
});
