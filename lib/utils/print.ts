/**
 * Sadə sənəd çapı / PDF (02 §2.5.2). Yeni pəncərədə HTML açır və brauzerin
 * çap dialoqunu çağırır (istifadəçi "PDF kimi saxla" seçə bilər).
 * Server-side PDF (Cloud Functions) sonrakı fazada əlavə oluna bilər.
 */
export function printDocument(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #111; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  .right { text-align: right; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .bold { font-weight: 700; border-top: 1px solid #ccc; padding-top: 6px; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${bodyHtml}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
  win.document.close();
}
