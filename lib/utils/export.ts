'use client';

import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  /** Sahə açarı və ya hesablayıcı funksiya */
  value: keyof T | ((row: T) => unknown);
  width?: number;
}

/** Cədvəli .xlsx olaraq ixrac edir (brendlənmiş başlıq sətri ilə) */
export function exportToExcel<T>(filename: string, columns: ExportColumn<T>[], rows: T[], sheetName = 'Məlumat'): void {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((c) => {
      const v = typeof c.value === 'function' ? (c.value as (r: T) => unknown)(row) : row[c.value as keyof T];
      return v ?? '';
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }));

  // Başlıq sətrini qalın et (cell style — yalnız xlsx-style dəstəyi olan oxucularda görünür)
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let col = range.s.c; col <= range.e.c; col++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[ref]) ws[ref].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}-${stamp}.xlsx`);
}

/** CSV ixracı (UTF-8 BOM ilə — Excel AZ hərflərini düzgün açsın) */
export function exportToCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]): void {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map((c) => esc(c.header)).join(';'),
    ...rows.map((row) => columns.map((c) => esc(typeof c.value === 'function' ? (c.value as (r: T) => unknown)(row) : row[c.value as keyof T])).join(';')),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
