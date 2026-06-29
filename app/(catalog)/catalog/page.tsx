'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Playfair_Display } from 'next/font/google';
import { ArrowRight, Loader2, LogOut, Minus, Plus, ShoppingBag, ShoppingCart, X } from 'lucide-react';
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

// Editorial serif — yalnız kataloq (moda jurnalı) başlıqları üçün
const serif = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700', '900'], style: ['normal', 'italic'] });

// Şəkilsiz məhsul üçün dərgi paneli rəngləri
const PANELS = ['bg-[#1a1c3a] text-white', 'bg-primary text-primary-foreground', 'bg-[#e7e3da] text-[#1a1c3a]', 'bg-[#2a2c45] text-white', 'bg-[#d9d6f5] text-[#2a2c45]'];

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

  const cover = products[0];
  const editorials = products.slice(1, 4);
  const season = cover?.collection || '2026 Kolleksiya';

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
      {/* Masthead */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
            <span className="text-foreground">Jurnal</span>
            <span>Lookbook</span>
            <Link href="/my-orders" className="hover:text-foreground">Sifarişlərim</Link>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild className="md:hidden"><Link href="/my-orders"><ShoppingBag className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" onClick={() => setCartOpen(true)} className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{cartCount}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => { await logout(firebaseUser); router.replace('/login'); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        {/* Jurnal adı bandı */}
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground lg:px-8">
            <span>UP · Denim Journal</span>
            <span>{season}</span>
            <span className="hidden sm:inline">№ {String(new Date().getFullYear()).slice(2)}</span>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="mx-auto max-w-[1400px] px-4 py-16 lg:px-8"><div className="h-[70vh] animate-pulse rounded-card bg-muted" /></div>
      ) : products.length === 0 ? (
        <p className="py-32 text-center text-muted-foreground">Hələ məhsul yoxdur.</p>
      ) : (
        <>
          {/* COVER — dərgi üz qabığı */}
          {cover && (
            <section className="relative">
              <div className="relative h-[78vh] w-full overflow-hidden">
                {cover.images?.[0]?.url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover.images[0].url} alt={cover.name?.az ?? ''} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#16182f]">
                    <span className={cn(serif.className, 'select-none text-[28vw] font-black leading-none text-white/10')}>UP</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-6 text-white lg:p-16">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">Cover Story · {season}</p>
                  <h1 className={cn(serif.className, 'max-w-3xl text-5xl font-bold leading-[0.95] tracking-tight lg:text-8xl')}>
                    {cover.name?.az}
                  </h1>
                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <span className="text-lg font-semibold">{formatCurrency(cover.wholesalePrice, 'AZN')}</span>
                    <span className="text-xs uppercase tracking-widest text-white/70">{cover.fit ? PRODUCT_FITS[cover.fit] : ''}{cover.colorName ? ` · ${cover.colorName}` : ''}{cover.washEffect ? ` · ${cover.washEffect}` : ''}</span>
                    <Button onClick={() => openProduct(cover)} className="shadow-glow">Modeli aç <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* EDITORIAL SPREAD-lər — nömrəli, növbələşən */}
          {editorials.length > 0 && (
            <section className="mx-auto max-w-[1400px] px-4 py-16 lg:px-8 lg:py-24">
              {editorials.map((p, idx) => {
                const img = p.images?.[0]?.url;
                const reverse = idx % 2 === 1;
                return (
                  <article key={p.id} className="mb-20 grid grid-cols-1 items-center gap-8 lg:mb-28 lg:grid-cols-2 lg:gap-16">
                    <div className={cn('relative aspect-[4/5] overflow-hidden rounded-card', reverse && 'lg:order-2')}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name?.az ?? ''} className="h-full w-full object-cover" />
                      ) : (
                        <div className={cn('flex h-full w-full items-center justify-center p-8', PANELS[idx % PANELS.length])}>
                          <span className={cn(serif.className, 'text-center text-4xl font-bold italic leading-tight')}>{p.name?.az}</span>
                        </div>
                      )}
                    </div>
                    <div className={cn(reverse && 'lg:order-1')}>
                      <span className={cn(serif.className, 'text-6xl font-black text-primary/30')}>{String(idx + 1).padStart(2, '0')}</span>
                      <h2 className={cn(serif.className, 'mt-2 text-4xl font-bold leading-tight lg:text-5xl')}>{p.name?.az}</h2>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                        {p.fit ? PRODUCT_FITS[p.fit] : ''}{p.colorName ? ` — ${p.colorName}` : ''}{p.weight ? ` — ${p.weight}` : ''}
                      </p>
                      {p.description?.az && <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">{p.description.az}</p>}
                      <div className="mt-6 flex items-center gap-4">
                        <span className="text-2xl font-bold text-foreground">{formatCurrency(p.wholesalePrice, 'AZN')}</span>
                        {p.retailPrice > 0 && <span className="text-sm text-muted-foreground line-through">{formatCurrency(p.retailPrice, 'AZN')}</span>}
                        <Button variant="outline" onClick={() => openProduct(p)}>Bax <ArrowRight className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {/* LOOKBOOK — masonry */}
          <section className="border-t border-border bg-secondary/40 py-16 lg:py-24">
            <div className="mx-auto max-w-[1400px] px-4 lg:px-8">
              <div className="mb-10 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">Bütün modellər</p>
                <h2 className={cn(serif.className, 'mt-2 text-4xl font-bold lg:text-6xl')}>Lookbook</h2>
              </div>
              <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
                {products.map((p, i) => {
                  const img = p.images?.[0]?.url;
                  const variants = variantsByProduct.get(p.id) ?? [];
                  const aspect = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[3/4]'][i % 4];
                  return (
                    <button key={p.id} onClick={() => openProduct(p)} className="group relative block w-full break-inside-avoid overflow-hidden rounded-card text-left shadow-soft">
                      <div className={cn('relative w-full overflow-hidden', aspect)}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={p.name?.az ?? ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className={cn('flex h-full w-full items-center justify-center p-6', PANELS[i % PANELS.length])}>
                            <span className={cn(serif.className, 'text-center text-2xl font-bold italic leading-tight')}>{p.name?.az}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <p className="text-sm font-semibold text-white">{p.name?.az}</p>
                        <p className="text-xs text-white/80">{formatCurrency(p.wholesalePrice, 'AZN')}{variants.length === 0 ? ' · tezliklə' : ''}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-border py-10 text-center">
        <span className={cn(serif.className, 'text-xl font-bold italic')}>UP · Denim Journal</span>
        <p className="mt-1 text-xs text-muted-foreground">{new Date().getFullYear()} · Premium B2B Denim</p>
      </footer>

      {/* Məhsul detalı — qalereya + variantlar */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl p-0">
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-muted p-4">
                <div className="aspect-[3/4] overflow-hidden rounded-md bg-background">
                  {selImages[activeImg] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selImages[activeImg]} alt={selected.name?.az ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn('flex h-full w-full items-center justify-center p-6', PANELS[0])}>
                      <span className={cn(serif.className, 'text-center text-3xl font-bold italic')}>{selected.name?.az}</span>
                    </div>
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

              <div className="max-h-[80vh] overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className={cn(serif.className, 'text-3xl')}>{selected.name?.az}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {selected.fit ? PRODUCT_FITS[selected.fit] : ''}{selected.colorName ? ` · ${selected.colorName}` : ''}{selected.weight ? ` · ${selected.weight}` : ''}
                </p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-primary">{formatCurrency(selected.wholesalePrice, 'AZN')}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">topdan / ədəd</span>
                  {selected.retailPrice > 0 && <span className="text-sm text-muted-foreground line-through">{formatCurrency(selected.retailPrice, 'AZN')}</span>}
                </div>
                {selected.description?.az && <p className="mt-4 leading-relaxed text-muted-foreground">{selected.description.az}</p>}

                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mövcud ölçülər</p>
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
