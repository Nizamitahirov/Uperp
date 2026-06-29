'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, Minus, Plus, Receipt, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { completePOSSale } from '@/lib/firebase/pos';
import { useAuth } from '@/components/providers/auth-provider';
import type { CashRegister, FinishedGoodStock, POSItem, Product } from '@/types';
import { VAT_RATE, PRODUCT_CATEGORIES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { printDocument } from '@/lib/utils/print';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const TILE_TINTS = [
  'from-[#5B5BF5] to-[#7C7CF8]', 'from-[#22C55E] to-[#4ADE80]', 'from-[#F59E0B] to-[#FBBF24]',
  'from-[#EC4899] to-[#F472B6]', 'from-[#06B6D4] to-[#22D3EE]', 'from-[#A855F7] to-[#C084FC]',
];
const tintOf = (s: string) => TILE_TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TILE_TINTS.length];

export default function POSPage() {
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [cart, setCart] = useState<POSItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [received, setReceived] = useState(0);
  const [registerId, setRegisterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: goods = [] } = useQuery({ queryKey: ['finished_goods'], queryFn: () => listDocs<FinishedGoodStock>('finished_goods', []) });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => listDocs<Product>('products', []) });
  const { data: registers = [] } = useQuery({ queryKey: ['cash_registers'], queryFn: () => listDocs<CashRegister>('cash_registers', [where('isActive', '==', true)]) });

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const available = useMemo(() => {
    const s = search.trim().toLowerCase();
    return goods.filter((g) => {
      if ((g.availableStock ?? 0) <= 0) return false;
      if (cat !== 'all' && productById.get(g.productId)?.category !== cat) return false;
      return !s || g.variantSku?.toLowerCase().includes(s) || g.productName?.toLowerCase().includes(s);
    });
  }, [goods, search, cat, productById]);

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmt = subtotal * (discount / 100);
  const net = subtotal - discountAmt;
  const vat = net * (VAT_RATE / 100);
  const total = net + vat;
  const change = method === 'cash' ? Math.max(0, received - total) : 0;
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  if (!can('pos', 'create')) return <p className="text-muted-foreground">POS-a girişiniz yoxdur.</p>;

  function addToCart(g: FinishedGoodStock) {
    const price = g.retailPrice || g.wholesalePrice || g.unitCost || 0;
    setCart((prev) => {
      const ex = prev.find((i) => i.finishedGoodId === g.id);
      if (ex) return prev.map((i) => i.finishedGoodId === g.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitPrice } : i);
      return [...prev, { finishedGoodId: g.id, variantSku: g.variantSku, productName: g.productName ?? '', quantity: 1, unitPrice: price, lineTotal: price }];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) => prev.map((i) => i.finishedGoodId === id ? { ...i, quantity: Math.max(1, i.quantity + delta), lineTotal: Math.max(1, i.quantity + delta) * i.unitPrice } : i));
  }

  async function complete() {
    if (cart.length === 0) { toast.error('Səbət boşdur'); return; }
    if (method === 'cash' && received < total) { toast.error('Alınan məbləğ yekundan azdır'); return; }
    setSubmitting(true);
    try {
      const reg = registers.find((r) => r.id === registerId);
      const receipt = await completePOSSale(
        { items: cart, discount: discountAmt, vat, subtotal, total, paymentMethod: method, amountReceived: method === 'cash' ? received : total, change, registerId: registerId || undefined, registerName: reg?.name },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      printReceipt(receipt);
      toast.success('Satış tamamlandı');
      setCart([]); setDiscount(0); setReceived(0);
    } catch (e) {
      toast.error('Satış alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function printReceipt(receiptNumber: string) {
    const rows = cart.map((i) => `<tr><td>${i.productName}</td><td class="right">×${i.quantity}</td><td class="right">${formatCurrency(i.lineTotal, 'AZN')}</td></tr>`).join('');
    printDocument(receiptNumber, `<div class="header"><div><h1>QƏBZ</h1><div class="muted">№ ${receiptNumber}</div></div><div class="muted">Kassir: ${profile?.username}</div></div>
      <table><tbody>${rows}</tbody></table>
      <div class="totals"><div><span>Ara cəm</span><span>${formatCurrency(subtotal, 'AZN')}</span></div><div><span>Endirim</span><span>−${formatCurrency(discountAmt, 'AZN')}</span></div><div><span>ƏDV</span><span>${formatCurrency(vat, 'AZN')}</span></div><div class="bold"><span>YEKUN</span><span>${formatCurrency(total, 'AZN')}</span></div><div><span>Ödəniş</span><span>${method}</span></div>${method === 'cash' ? `<div><span>Nağd</span><span>${formatCurrency(received, 'AZN')}</span></div><div><span>Qaytarma</span><span>${formatCurrency(change, 'AZN')}</span></div>` : ''}</div>
      <p style="text-align:center;margin-top:24px">Təşəkkürlər!</p>`);
  }

  const quickCash = [total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);

  return (
    <div className="-m-4 lg:-m-6">
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* ── Sol: kateqoriya + məhsul tiles ── */}
        <div className="flex min-w-0 flex-col border-r border-border">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 pl-9" placeholder="Məhsul və ya SKU axtar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Kateqoriya çipləri */}
          <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
            <Chip active={cat === 'all'} onClick={() => setCat('all')}>Hamısı</Chip>
            {PRODUCT_CATEGORIES.map((c) => <Chip key={c.value} active={cat === c.value} onClick={() => setCat(c.value)}>{c.label}</Chip>)}
          </div>

          {/* Tiles grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {available.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Mövcud hazır məhsul yoxdur</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {available.map((g) => {
                  const p = productById.get(g.productId);
                  const img = p?.images?.find((i) => i.isPrimary)?.url ?? p?.images?.[0]?.url;
                  const price = g.retailPrice || g.wholesalePrice || g.unitCost || 0;
                  return (
                    <button
                      key={g.id}
                      onClick={() => addToCart(g)}
                      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg active:translate-y-0"
                    >
                      <div className="relative aspect-square w-full overflow-hidden">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={g.productName ?? ''} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br p-2', tintOf(g.productName ?? g.variantSku))}>
                            <span className="text-center text-sm font-bold leading-tight text-white/95 line-clamp-3">{g.productName}</span>
                          </div>
                        )}
                        <Badge className="absolute right-1.5 top-1.5 bg-black/55 text-[10px] text-white backdrop-blur-sm">{g.availableStock} ədəd</Badge>
                        <span className="absolute bottom-1.5 left-1.5 rounded-button bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{g.size} · {g.grade}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-2.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight">{g.productName}</p>
                        <p className="text-[11px] text-muted-foreground">{g.variantSku}</p>
                        <p className="mt-auto pt-1.5 text-base font-bold text-primary">{formatCurrency(price, 'AZN')}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sağ: sifariş qəbzi ── */}
        <div className="flex h-full flex-col bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div className="flex items-center gap-2 font-semibold"><Receipt className="h-5 w-5 text-primary" /> Sifariş
              {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{count}</span>}
            </div>
            {cart.length > 0 && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setCart([])}><Trash2 className="h-4 w-4" /> Təmizlə</Button>}
          </div>

          {/* Sətirlər */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-10 w-10 opacity-30" />
                Məhsul seçin
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map((i) => (
                  <div key={i.finishedGoodId} className="flex items-center gap-2 rounded-card border border-border bg-background p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{i.productName}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(i.unitPrice, 'AZN')} × {i.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.finishedGoodId, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-semibold tnum">{i.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.finishedGoodId, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="w-20 text-right text-sm font-bold tnum">{formatCurrency(i.lineTotal, 'AZN')}</span>
                    <button className="text-muted-foreground hover:text-danger" onClick={() => setCart(cart.filter((x) => x.finishedGoodId !== i.finishedGoodId))}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yekun + ödəniş */}
          <div className="border-t border-border bg-secondary/40 p-4">
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Endirim %</span>
                <Input type="number" className="h-8 w-20 text-right" value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, +e.target.value)))} />
              </div>
              <Row label="Ara cəm" value={formatCurrency(subtotal, 'AZN')} />
              {discountAmt > 0 && <Row label="Endirim" value={`−${formatCurrency(discountAmt, 'AZN')}`} />}
              <Row label={`ƏDV (${VAT_RATE}%)`} value={formatCurrency(vat, 'AZN')} />
              <div className="flex items-center justify-between border-t border-border pt-2 text-lg font-bold"><span>YEKUN</span><span className="text-primary">{formatCurrency(total, 'AZN')}</span></div>
            </div>

            {registers.length > 0 && (
              <Select value={registerId} onValueChange={setRegisterId}>
                <SelectTrigger className="mb-2 h-9"><SelectValue placeholder="Kassa seç (opsional)" /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            )}

            <div className="mb-2 grid grid-cols-3 gap-2">
              {(['cash', 'card', 'transfer'] as const).map((mth) => (
                <button
                  key={mth}
                  onClick={() => setMethod(mth)}
                  className={cn('rounded-button border py-2 text-sm font-semibold transition-colors', method === mth ? 'border-primary bg-primary text-primary-foreground shadow-glow' : 'border-border hover:bg-background')}
                >
                  {mth === 'cash' ? 'Nağd' : mth === 'card' ? 'Kart' : 'Köçürmə'}
                </button>
              ))}
            </div>

            {method === 'cash' && (
              <div className="mb-2 space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {quickCash.map((v) => (
                    <button key={v} onClick={() => setReceived(v)} className="rounded-button border border-border py-1.5 text-xs font-medium hover:bg-background">{v}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Alınan</span>
                  <Input type="number" className="h-9 w-32 text-right text-base font-semibold" value={received || ''} onChange={(e) => setReceived(+e.target.value)} />
                </div>
                {received > 0 && (
                  <div className="flex items-center justify-between rounded-button bg-success/10 px-3 py-1.5 text-sm font-bold text-success">
                    <span>Qaytarma</span><span>{formatCurrency(change, 'AZN')}</span>
                  </div>
                )}
              </div>
            )}

            <Button className="h-12 w-full text-base shadow-glow" onClick={complete} disabled={submitting || cart.length === 0}>
              {submitting ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
              {cart.length > 0 ? `Tamamla · ${formatCurrency(total, 'AZN')}` : 'Tamamla'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors', active ? 'border-primary bg-primary text-primary-foreground shadow-glow' : 'border-border hover:bg-secondary')}
    >
      {children}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={cn('flex justify-between', bold ? 'font-bold' : 'text-muted-foreground')}><span>{label}</span><span className="tnum">{value}</span></div>;
}
