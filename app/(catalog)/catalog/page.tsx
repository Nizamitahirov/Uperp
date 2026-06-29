'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, LogOut, ShoppingBag, ShoppingCart, X, Package } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createSalesOrder } from '@/lib/firebase/sales';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import type { FinishedGoodStock, Product, SalesOrderItem } from '@/types';
import { PRODUCT_FITS, VAT_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

export default function CatalogPage() {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<SalesOrderItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace('/login');
  }, [loading, firebaseUser, router]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['catalog-products'],
    queryFn: () => listDocs<Product>('products', [where('status', '==', 'active')]),
    enabled: !!firebaseUser,
  });
  const { data: goods = [] } = useQuery({
    queryKey: ['catalog-goods'],
    queryFn: () => listDocs<FinishedGoodStock>('finished_goods', []),
    enabled: !!firebaseUser,
  });

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, FinishedGoodStock[]>();
    for (const g of goods) {
      if ((g.availableStock ?? 0) <= 0) continue;
      const arr = map.get(g.productId) ?? [];
      arr.push(g);
      map.set(g.productId, arr);
    }
    return map;
  }, [goods]);

  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);

  if (loading || !firebaseUser) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  function addToCart(fg: FinishedGoodStock, product: Product) {
    const price = fg.wholesalePrice || product.wholesalePrice || fg.unitCost || 0;
    setCart((prev) => {
      const ex = prev.find((i) => i.finishedGoodId === fg.id);
      if (ex) return prev.map((i) => i.finishedGoodId === fg.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitPrice } : i);
      return [...prev, { finishedGoodId: fg.id, variantSku: fg.variantSku, productName: product.name?.az ?? '', size: fg.size, grade: fg.grade, quantity: 1, unitPrice: price, discount: 0, lineTotal: price }];
    });
    toast.success('Səbətə əlavə edildi');
  }

  async function checkout() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      await createSalesOrder(
        { customerId: firebaseUser!.uid, customerName: profile?.fullName || firebaseUser!.email || 'Müştəri', channel: 'online', items: cart, paymentMethod: 'credit' },
        { uid: firebaseUser!.uid, username: profile?.username ?? firebaseUser!.email ?? '' },
      );
      toast.success('Sifariş göndərildi!', 'Satış meneceri təsdiqləyəcək');
      setCart([]); setCartOpen(false);
      router.push('/my-orders');
    } catch (e) {
      toast.error('Sifariş göndərilmədi', e instanceof Error ? e.message : undefined);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href="/my-orders"><ShoppingBag className="h-4 w-4" /> Sifarişlərim</Link></Button>
          <Button variant="ghost" size="icon" onClick={() => setCartOpen(true)} className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{cart.length}</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await logout(firebaseUser); router.replace('/login'); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-display text-5xl font-bold tracking-tight">Yeni Kolleksiya</h2>
          <p className="mt-3 text-muted-foreground">Premium denim — topdan sifariş</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-muted" />)}</div>
        ) : products.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">Hələ məhsul yoxdur.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const variants = variantsByProduct.get(p.id) ?? [];
              return (
                <button key={p.id} onClick={() => setSelected(p)} className="group text-left">
                  <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-card bg-muted transition-transform group-hover:scale-[1.02]">
                    {p.images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0].url} alt={p.name?.az ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="font-display text-lg font-semibold leading-tight">{p.name?.az}</p>
                    <p className="text-sm text-muted-foreground">{p.fit ? PRODUCT_FITS[p.fit] : ''} {p.colorName ? `· ${p.colorName}` : ''}</p>
                    <p className="mt-1 font-medium">{formatCurrency(p.wholesalePrice, 'AZN')}</p>
                    <p className="text-xs text-muted-foreground">{variants.length > 0 ? `${variants.length} variant mövcuddur` : 'Stokda yoxdur'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Məhsul / variant seçimi */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.name?.az}</DialogTitle></DialogHeader>
          {selected && (
            <div>
              {selected.description?.az && <p className="mb-4 text-sm text-muted-foreground">{selected.description.az}</p>}
              <p className="mb-2 text-sm font-medium">Mövcud variantlar:</p>
              <div className="space-y-2">
                {(variantsByProduct.get(selected.id) ?? []).map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-button border p-2">
                    <div>
                      <p className="text-sm font-medium">{v.size} · Sort {v.grade}</p>
                      <p className="text-xs text-muted-foreground">Mövcud: {v.availableStock}</p>
                    </div>
                    <Button size="sm" onClick={() => addToCart(v, selected)}>Səbətə</Button>
                  </div>
                ))}
                {(variantsByProduct.get(selected.id) ?? []).length === 0 && <p className="text-sm text-muted-foreground">Hazırda stokda variant yoxdur.</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Səbət */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Səbət</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Səbət boşdur</p>
          ) : (
            <div className="space-y-3">
              {cart.map((i) => (
                <div key={i.finishedGoodId} className="flex items-center gap-2 text-sm">
                  <div className="flex-1"><p className="font-medium">{i.productName}</p><p className="text-xs text-muted-foreground">{i.size}/{i.grade} · ×{i.quantity}</p></div>
                  <span className="font-medium">{formatCurrency(i.lineTotal, 'AZN')}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-danger" onClick={() => setCart(cart.filter((x) => x.finishedGoodId !== i.finishedGoodId))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-sm"><span>Ara cəm</span><span>{formatCurrency(cartTotal, 'AZN')}</span></div>
              <p className="text-xs text-muted-foreground">ƏDV ({VAT_RATE}%) və endirim təsdiq zamanı hesablanacaq.</p>
              <Button className="w-full" onClick={checkout} disabled={placing}>{placing && <Loader2 className="animate-spin" />} Sifarişi göndər</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
