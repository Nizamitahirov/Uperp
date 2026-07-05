'use client';

import * as XLSX from 'xlsx';

/** Excel/CSV faylını başlıq-açarlı sətirlərə çevirir */
export async function parseSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = String(v ?? '').trim();
    return out;
  });
}

/** Başlıq şablonu (boş) Excel olaraq yükləyir */
export function downloadTemplate(filename: string, headers: string[]): void {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
  XLSX.writeFile(wb, `${filename}-sablon.xlsx`);
}
