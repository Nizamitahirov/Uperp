'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { completePOSSale } from '@/lib/firebase/pos';
import { useAuth } from '@/components/providers/auth-provider';
import type { CashRegister, FinishedGoodStock, POSItem } from '@/types';
import { VAT_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { printDocument } from '@/lib/utils/print';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

export default function POSPage() {
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<POSItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [received, setReceived] = useState(0);
  const [registerId, setRegisterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: goods = [] } = useQuery({ queryKey: ['finished_goods'], queryFn: () => listDocs<FinishedGoodStock>('finished_goods', []) });
  const { data: registers = [] } = useQuery({ queryKey: ['cash_registers'], queryFn: () => listDocs<CashRegister>('cash_registers', [where('isActive', '==', true)]) });

  const available = useMemo(() => {
    const s = search.trim().toLowerCase();
    return goods.filter((g) => (g.availableStock ?? 0) > 0 && (!s || g.variantSku?.toLowerCase().includes(s) || g.productName?.toLowerCase().includes(s)));
  }, [goods, search]);

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmt = subtotal * (discount / 100);
  const net = subtotal - discountAmt;
  const vat = net * (VAT_RATE / 100);
  const total = net + vat;
  const change = method === 'cash' ? Math.max(0, received - total) : 0;

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

  return (
    <div>
      <PageHeader title="POS — Pərakəndə Satış" subtitle="Sürətli satış interfeysi" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Məhsul grid */}
        <div className="lg:col-span-3">
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="SKU və ya ad axtar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {available.length === 0 ? (
            <Card className="rounded-card"><CardContent className="p-8 text-center text-sm text-muted-foreground">Mövcud hazır məhsul yoxdur</CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {available.map((g) => (
                <button key={g.id} onClick={() => addToCart(g)} className="rounded-card border p-3 text-left transition-colors hover:bg-accent">
                  <p className="text-sm font-medium leading-tight">{g.productName}</p>
                  <p className="text-xs text-muted-foreground">{g.variantSku}</p>
                  <p className="mt-1 text-sm font-bold">{formatCurrency(g.retailPrice || g.wholesalePrice || g.unitCost || 0, 'AZN')}</p>
                  <p className="text-xs text-muted-foreground">Mövcud: {g.availableStock}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Səbət */}
        <div className="lg:col-span-2">
          <Card className="rounded-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4" /> Səbət</div>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Səbət boşdur</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((i) => (
                    <div key={i.finishedGoodId} className="flex items-center gap-2 text-sm">
                      <div className="flex-1"><p className="font-medium leading-tight">{i.productName}</p><p className="text-xs text-muted-foreground">{formatCurrency(i.unitPrice, 'AZN')}</p></div>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(i.finishedGoodId, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center">{i.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(i.finishedGoodId, 1)}><Plus className="h-3 w-3" /></Button>
                      <span className="w-20 text-right font-medium">{formatCurrency(i.lineTotal, 'AZN')}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-danger" onClick={() => setCart(cart.filter((x) => x.finishedGoodId !== i.finishedGoodId))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                <div className="flex items-center justify-between"><Label>Endirim %</Label><Input type="number" className="w-24" value={discount} onChange={(e) => setDiscount(+e.target.value)} /></div>
                <Row label="Ara cəm" value={formatCurrency(subtotal, 'AZN')} />
                <Row label="Endirim" value={`−${formatCurrency(discountAmt, 'AZN')}`} />
                <Row label={`ƏDV (${VAT_RATE}%)`} value={formatCurrency(vat, 'AZN')} />
                <Row label="YEKUN" value={formatCurrency(total, 'AZN')} bold />
              </div>

              <div className="mt-3 space-y-2">
                <Select value={registerId} onValueChange={setRegisterId}>
                  <SelectTrigger><SelectValue placeholder="Kassa seç (opsional)" /></SelectTrigger>
                  <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'transfer'] as const).map((m) => (
                    <Button key={m} variant={method === m ? 'default' : 'outline'} size="sm" onClick={() => setMethod(m)}>
                      {m === 'cash' ? 'Nağd' : m === 'card' ? 'Kart' : 'Köçürmə'}
                    </Button>
                  ))}
                </div>
                {method === 'cash' && (
                  <div className="flex items-center justify-between"><Label>Alınan</Label><Input type="number" className="w-32" value={received} onChange={(e) => setReceived(+e.target.value)} /></div>
                )}
                {method === 'cash' && received > 0 && <Row label="Qaytarma" value={formatCurrency(change, 'AZN')} bold />}
                <Button className="w-full" onClick={complete} disabled={submitting || cart.length === 0}>
                  {submitting ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Satışı tamamla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'font-bold' : 'text-muted-foreground'}`}><span>{label}</span><span>{value}</span></div>;
}
