/**
 * Brendlənmiş sənəd çapı / PDF.
 * Yeni pəncərədə korporativ dizaynlı HTML açır və çap dialoqunu çağırır
 * (istifadəçi "PDF kimi saxla" seçə bilər). Bütün sənədlər (faktura, PO, GRN,
 * qəbz) eyni UP ERP brendinə uyğun görünür.
 */
export interface PrintOptions {
  company?: { name?: string; taxNumber?: string; address?: string; phone?: string; email?: string };
  /** Sənəd növü etiketi (məs. "FAKTURA", "QAİMƏ") */
  docType?: string;
  /** Sənəd nömrəsi */
  docNumber?: string;
  /** Sağ üstdə əlavə meta sətirləri */
  meta?: { label: string; value: string }[];
}

const BRAND = '#5B5BF5';
const INK = '#16182f';

export function printDocument(title: string, bodyHtml: string, opts: PrintOptions = {}): void {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;

  const company = opts.company ?? {};
  const companyName = company.name || 'UP ERP';
  const metaRows = (opts.meta ?? [])
    .map((m) => `<div><span>${m.label}</span><b>${m.value}</b></div>`)
    .join('');

  const docBadge = opts.docType
    ? `<div class="doc-badge"><div class="doc-type">${opts.docType}</div>${opts.docNumber ? `<div class="doc-no">№ ${opts.docNumber}</div>` : ''}</div>`
    : '';

  win.document.write(`<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', Arial, sans-serif; color: ${INK}; font-size: 13px; line-height: 1.5; padding: 36px 40px; }

  .brand { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 18px; border-bottom: 3px solid ${BRAND}; }
  .brand-left { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 11px; background: ${BRAND}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; letter-spacing: -.5px; }
  .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -.3px; }
  .brand-sub { font-size: 11px; color: #6b6f8a; margin-top: 1px; }
  .company-meta { text-align: right; font-size: 11px; color: #6b6f8a; line-height: 1.6; }

  .doc-head { display: flex; align-items: flex-start; justify-content: space-between; margin-top: 20px; }
  .doc-type { font-size: 22px; font-weight: 800; letter-spacing: -.4px; color: ${INK}; }
  .doc-no { font-size: 12px; color: #6b6f8a; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 12px; }
  .doc-meta div { display: flex; gap: 12px; justify-content: flex-end; padding: 1px 0; }
  .doc-meta span { color: #6b6f8a; }

  h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .muted { color: #6b6f8a; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 18px; }

  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12.5px; }
  thead th { background: ${BRAND}; color: #fff; padding: 9px 10px; text-align: left; font-weight: 600; }
  thead th:first-child { border-radius: 6px 0 0 6px; }
  thead th:last-child { border-radius: 0 6px 6px 0; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e7e9f2; }
  tbody tr:nth-child(even) { background: #f7f8fc; }
  .right { text-align: right; }

  .totals { margin-top: 18px; width: 300px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .bold { font-weight: 700; border-top: 2px solid ${BRAND}; margin-top: 4px; padding-top: 8px; font-size: 15px; }

  .sign { margin-top: 54px; display: flex; justify-content: space-between; font-size: 12.5px; }
  .sign div { width: 45%; }
  .sign .line { margin-top: 36px; border-top: 1px solid #c9cce0; padding-top: 6px; color: #6b6f8a; }

  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e7e9f2; display: flex; justify-content: space-between; font-size: 10.5px; color: #9aa0bd; }

  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <div class="brand">
    <div class="brand-left">
      <div class="logo">UP</div>
      <div>
        <div class="brand-name">${companyName}</div>
        <div class="brand-sub">Premium Denim · ERP/MES</div>
      </div>
    </div>
    <div class="company-meta">
      ${company.taxNumber ? `VÖEN: ${company.taxNumber}<br/>` : ''}
      ${company.address ? `${company.address}<br/>` : ''}
      ${company.phone ? `Tel: ${company.phone}<br/>` : ''}
      ${company.email ? `${company.email}` : ''}
    </div>
  </div>

  ${docBadge || metaRows ? `<div class="doc-head">${docBadge}<div class="doc-meta">${metaRows}</div></div>` : ''}

  ${bodyHtml}

  <div class="footer">
    <span>${companyName} · UP ERP ilə yaradılıb</span>
    <span>${new Date().toLocaleString('az-AZ')}</span>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); }</script>
</body>
</html>`);
  win.document.close();
}
