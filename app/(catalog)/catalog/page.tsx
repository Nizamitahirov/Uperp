'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, LogOut, Minus, Plus, ShoppingBag, ShoppingCart, X, Package } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createSalesOrder } from '@/lib/firebase/sales';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import type { FinishedGoodStock, Product, SalesOrderItem } from '@/types';
import { PRODUCT_FITS, VAT_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

export default function CatalogPage() {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Product | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({});
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

  // Kolleksiyalara qruplaşdır (moda jurnalı bölmələri)
  const collections = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.collection || 'Kolleksiya';
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [products]);

  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  function openProduct(p: Product) {
    setSelected(p);
    setActiveImg(0);
    setQtyByVariant({});
  }

  function addVariant(fg: FinishedGoodStock, product: Product) {
    const qty = Math.max(1, qtyByVariant[fg.id] ?? 1);
    const price = fg.wholesalePrice || product.wholesalePrice || fg.unitCost || 0;
    setCart((prev) => {
      const ex = prev.find((i) => i.finishedGoodId === fg.id);
      if (ex) return prev.map((i) => i.finishedGoodId === fg.id ? { ...i, quantity: i.quantity + qty, lineTotal: (i.quantity + qty) * i.unitPrice } : i);
      return [...prev, { finishedGoodId: fg.id, variantSku: fg.variantSku, productName: product.name?.az ?? '', size: fg.size, grade: fg.grade, quantity: qty, unitPrice: price, discount: 0, lineTotal: price * qty }];
    });
    toast.success(`Səbətə əlavə edildi (${qty})`);
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

  if (loading || !firebaseUser) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const selVariants = selected ? variantsByProduct.get(selected.id) ?? [] : [];
  const selImages = selected?.images?.map((i) => i.url) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:flex">
          <span className="text-foreground">Kolleksiya</span>
          <span>Məhsullar</span>
          <Link href="/my-orders" className="hover:text-foreground">Sifarişlərim</Link>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="md:hidden"><Link href="/my-orders"><ShoppingBag className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={() => setCartOpen(true)} className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{cartCount}</span>}
          </Button>
          <Button variant="ghost" size="icon" onClick={async () => { await logout(firebaseUser); router.replace('/login'); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Editorial hero */}
      <section className="relative overflow-hidden border-b border-border bg-primary-soft">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-4 py-16 lg:grid-cols-2 lg:px-10 lg:py-24">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-primary">UP ERP · B2B Kataloq</p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground lg:text-7xl">
              Premium<br />Denim<br />Kolleksiyası
            </h1>
            <p className="mt-5 max-w-md text-sm text-muted-foreground">
              Topdan alıcılar üçün — modelləri seç, ölçü və miqdarı təyin et, sifarişi birbaşa göndər.
            </p>
            <Button className="mt-6 shadow-glow" onClick={() => document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth' })}>
              Kolleksiyaya bax
            </Button>
          </div>
          <div className="hidden justify-end lg:flex">
            <div className="flex h-80 w-80 items-center justify-center rounded-card bg-primary/10 ring-1 ring-primary/20">
              <span className="font-display text-[10rem] font-black leading-none text-primary/30">UP</span>
            </div>
          </div>
        </div>
      </section>

      {/* Kolleksiyalar */}
      <main id="grid" className="mx-auto max-w-7xl px-4 py-12 lg:px-10">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-muted" />)}</div>
        ) : products.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">Hələ məhsul yoxdur.</p>
        ) : (
          collections.map(([name, items]) => (
            <section key={name} className="mb-16">
              <div className="mb-6 flex items-end justify-between border-b border-border pb-3">
                <h2 className="font-display text-2xl font-bold tracking-tight">{name}</h2>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{items.length} model</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => {
                  const variants = variantsByProduct.get(p.id) ?? [];
                  const img0 = p.images?.[0]?.url;
                  const img1 = p.images?.[1]?.url;
                  return (
                    <button key={p.id} onClick={() => openProduct(p)} className="group text-left">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-muted shadow-soft">
                        {img0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img0} alt={p.name?.az ?? ''} className={cn('h-full w-full object-cover transition-opacity duration-500', img1 && 'group-hover:opacity-0')} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Package className="h-12 w-12 text-muted-foreground/30" /></div>
                        )}
                        {img1 && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img1} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        )}
                        {variants.length === 0 && (
                          <span className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-background">Tezliklə</span>
                        )}
                        {p.washEffect && (
                          <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">{p.washEffect}</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="font-display text-base font-semibold leading-tight">{p.name?.az}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {p.fit ? PRODUCT_FITS[p.fit] : ''}{p.colorName ? ` · ${p.colorName}` : ''}
                        </p>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="text-base font-bold text-foreground">{formatCurrency(p.wholesalePrice, 'AZN')}</span>
                          {p.retailPrice > 0 && <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.retailPrice, 'AZN')}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        UP ERP · Premium Denim · {new Date().getFullYear()}
      </footer>

      {/* Məhsul detalı — qalereya + variantlar */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl p-0">
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Qalereya */}
              <div className="bg-muted p-4">
                <div className="aspect-[3/4] overflow-hidden rounded-md bg-background">
                  {selImages[activeImg] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selImages[activeImg]} alt={selected.name?.az ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Package className="h-16 w-16 text-muted-foreground/30" /></div>
                  )}
                </div>
                {selImages.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {selImages.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="" onClick={() => setActiveImg(i)} className={cn('h-16 w-12 shrink-0 cursor-pointer rounded object-cover ring-2 transition', i === activeImg ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')} />
                    ))}
                  </div>
                )}
              </div>

              {/* Məlumat + variant */}
              <div className="max-h-[80vh] overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">{selected.name?.az}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {selected.fit ? PRODUCT_FITS[selected.fit] : ''}{selected.colorName ? ` · ${selected.colorName}` : ''}{selected.weight ? ` · ${selected.weight}` : ''}
                </p>

                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-primary">{formatCurrency(selected.wholesalePrice, 'AZN')}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">topdan / ədəd</span>
                  {selected.retailPrice > 0 && <span className="text-sm text-muted-foreground line-through">{formatCurrency(selected.retailPrice, 'AZN')}</span>}
                </div>

                {selected.description?.az && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{selected.description.az}</p>}

                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mövcud ölçülər</p>
                  {selVariants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Hazırda stokda variant yoxdur.</p>
                  ) : (
                    <div className="space-y-2">
                      {selVariants.map((v) => {
                        const qty = qtyByVariant[v.id] ?? 1;
                        return (
                          <div key={v.id} className="flex items-center justify-between gap-2 rounded-button border border-border p-2">
                            <div>
                              <p className="text-sm font-semibold">{v.size} <span className="text-xs font-normal text-muted-foreground">· Sort {v.grade}</span></p>
                              <p className="text-xs text-muted-foreground">Mövcud: {v.availableStock}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQtyByVariant((p) => ({ ...p, [v.id]: Math.max(1, (p[v.id] ?? 1) - 1) }))}><Minus className="h-3 w-3" /></Button>
                              <span className="w-7 text-center text-sm tnum">{qty}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQtyByVariant((p) => ({ ...p, [v.id]: (p[v.id] ?? 1) + 1 }))}><Plus className="h-3 w-3" /></Button>
                              <Button size="sm" className="ml-1" onClick={() => addVariant(v, selected)}>Səbətə</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                  <span className="font-medium tnum">{formatCurrency(i.lineTotal, 'AZN')}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-danger" onClick={() => setCart(cart.filter((x) => x.finishedGoodId !== i.finishedGoodId))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Ara cəm</span><span className="tnum">{formatCurrency(cartTotal, 'AZN')}</span></div>
              <p className="text-xs text-muted-foreground">ƏDV ({VAT_RATE}%) və endirim təsdiq zamanı hesablanacaq.</p>
              <Button className="w-full shadow-glow" onClick={checkout} disabled={placing}>{placing && <Loader2 className="animate-spin" />} Sifarişi göndər</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
