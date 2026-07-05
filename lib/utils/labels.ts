'use client';

import QRCode from 'qrcode';
import { code128Svg } from './barcode';

export interface LabelItem {
  code: string;
  name: string;
  sub?: string; // qiymət / ölçü və s.
}

/**
 * Barkod + QR etiket vərəqi çap edir (yeni pəncərə, print dialoqu).
 * Hər etiketdə: ad, Code128 barkod, QR kod və oxunaqlı kod.
 */
export async function printLabels(items: LabelItem[], opts: { qr?: boolean; barcode?: boolean; company?: string } = {}): Promise<void> {
  const showQr = opts.qr ?? true;
  const showBarcode = opts.barcode ?? true;

  const cards = await Promise.all(items.map(async (it) => {
    const barcode = showBarcode ? code128Svg(it.code, { height: 44 }) : '';
    const qr = showQr ? await QRCode.toString(it.code, { type: 'svg', margin: 0, width: 72 }) : '';
    return `
      <div class="label">
        <div class="lname">${escapeHtml(it.name)}</div>
        ${it.sub ? `<div class="lsub">${escapeHtml(it.sub)}</div>` : ''}
        <div class="codes">
          ${showBarcode ? `<div class="bc">${barcode}</div>` : ''}
          ${showQr ? `<div class="qr">${qr}</div>` : ''}
        </div>
        <div class="lcode">${escapeHtml(it.code)}</div>
      </div>`;
  }));

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="az"><head><meta charset="utf-8"/><title>Etiketlər</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', Arial, sans-serif; padding: 12px; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .label { border: 1px dashed #cbd0e0; border-radius: 8px; padding: 8px; text-align: center; page-break-inside: avoid; }
  .lname { font-size: 12px; font-weight: 700; line-height: 1.2; max-height: 30px; overflow: hidden; }
  .lsub { font-size: 10px; color: #6b6f8a; margin-top: 1px; }
  .codes { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 6px 0 2px; }
  .bc svg { max-width: 150px; height: 44px; }
  .qr svg { width: 56px; height: 56px; }
  .lcode { font-family: monospace; font-size: 11px; font-weight: 600; letter-spacing: .5px; }
  @media print { @page { margin: 8mm; } .label { border-color: #e2e5f0; } }
</style></head><body>
  <div class="sheet">${cards.join('')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
