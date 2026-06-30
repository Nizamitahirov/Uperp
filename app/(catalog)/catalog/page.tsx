'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Playfair_Display, Space_Grotesk } from 'next/font/google';
import { ArrowDownRight, ArrowRight, Images, Loader2, LogOut, Minus, Plus, ShoppingBag, ShoppingCart, Sparkles, X } from 'lucide-react';
import { listDocs, getDocById } from '@/lib/firebase/firestore';
import { listPublishedCatalogs } from '@/lib/firebase/catalogs';
import { createSalesOrder } from '@/lib/firebase/sales';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import type { Catalog, FinishedGoodStock, Product, SalesOrderItem } from '@/types';
import { PRODUCT_FITS, VAT_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slideshow } from '@/components/catalog/slideshow';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

// Editorial serif — böyük başlıqlar üçün (luks kontrast)
const serif = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700', '900'], style: ['normal', 'italic'] });
// Futuristik geometrik sans — texniki etiketlər/UI üçün
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

// Şəkilsiz məhsul üçün neon gradient panellər
const PANELS = [
  'bg-gradient-to-br from-[#5B5BF5] to-[#9333ea]',
  'bg-gradient-to-br from-[#06b6d4] to-[#3b82f6]',
  'bg-gradient-to-br from-[#ec4899] to-[#8b5cf6]',
  'bg-gradient-to-br from-[#14b8a6] to-[#5B5BF5]',
  'bg-gradient-to-br from-[#f59e0b] to-[#ec4899]',
];

const imgs = (p?: Product) => p?.images?.map((i) => i.url).filter(Boolean) ?? [];

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <CatalogInner />
    </Suspense>
  );
}

function CatalogInner() {
  const { firebaseUser, profile, loading, can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const journalParam = params.get('journal');
  const canManage = can('products', 'update');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<SalesOrderItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace('/login');
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (journalParam) setActiveId(journalParam);
  }, [journalParam]);

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
  const { data: published = [] } = useQuery({
    queryKey: ['catalog-published'],
    queryFn: () => listPublishedCatalogs(),
    enabled: !!firebaseUser,
  });
  // Admin preview — dərc olunmamış jurnalı da göstər (yalnız idarəçi üçün)
  const { data: previewCatalog } = useQuery({
    queryKey: ['catalog-preview', journalParam],
    queryFn: () => getDocById<Catalog>('catalogs', journalParam!),
    enabled: !!firebaseUser && !!journalParam && canManage,
  });

  const catalogs = useMemo(() => {
    const list = [...published];
    if (previewCatalog && !list.some((c) => c.id === previewCatalog.id)) list.unshift(previewCatalog);
    return list;
  }, [published, previewCatalog]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const active = useMemo(() => {
    if (catalogs.length === 0) return null;
    const id = activeId ?? catalogs[0].id;
    return catalogs.find((c) => c.id === id) ?? catalogs[0];
  }, [catalogs, activeId]);

  // Jurnaldakı modellər — sıralı (katalog varsa), yoxdursa bütün aktiv məhsullar
  const ordered = useMemo(() => {
    if (!active) return products;
    return active.productIds.map((id) => productById.get(id)).filter((p): p is Product => !!p);
  }, [active, products, productById]);

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

  const coverId = active?.coverProductId || active?.productIds[0];
  const cover = coverId ? productById.get(coverId) ?? ordered[0] : ordered[0];
  const rest = ordered.filter((p) => p.id !== cover?.id);
  const editorials = rest.slice(0, 3);

  const title = active?.title?.az || 'UP · Denim Journal';
  const season = active?.season || active?.collectionName || cover?.collection || '2026 Kolleksiya';
  const issue = active?.issueNumber || String(new Date().getFullYear()).slice(2);
  const subtitle = active?.subtitle;
  const isDraftPreview = active && active.status !== 'published';

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
  const selImages = imgs(selected ?? undefined);
  const coverImgs = imgs(cover);

  return (
    <div className={cn(grotesk.className, 'relative min-h-screen overflow-x-hidden bg-[#06070f] text-white')}>
      {/* Aurora fon + grid overlay */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-[#5B5BF5]/25 blur-[140px]" />
        <div className="absolute -right-40 top-1/3 h-[36rem] w-[36rem] rounded-full bg-[#06b6d4]/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[34rem] w-[34rem] rounded-full bg-[#ec4899]/12 blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="relative z-10">
        {/* Masthead — glass */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06070f]/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B5BF5] to-[#9333ea] text-sm font-bold shadow-[0_0_24px_rgba(91,91,245,0.5)]">UP</span>
              <span className="text-sm font-semibold tracking-tight">UP <span className="text-white/50">Denim</span></span>
            </div>
            <nav className="hidden items-center gap-8 text-[11px] font-medium uppercase tracking-[0.25em] text-white/45 md:flex">
              <span className="text-white">Jurnal</span>
              <a href="#lookbook" className="transition-colors hover:text-white">Lookbook</a>
              <Link href="/my-orders" className="transition-colors hover:text-white">Sifarişlərim</Link>
            </nav>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild className="text-white/70 hover:bg-white/10 hover:text-white md:hidden"><Link href="/my-orders"><ShoppingBag className="h-4 w-4" /></Link></Button>
              <Button variant="ghost" size="icon" onClick={() => setCartOpen(true)} className="relative text-white/70 hover:bg-white/10 hover:text-white">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#5B5BF5] to-[#9333ea] px-1 text-[10px] font-bold shadow-[0_0_12px_rgba(91,91,245,0.6)]">{cartCount}</span>}
              </Button>
              <Button variant="ghost" size="icon" onClick={async () => { await logout(firebaseUser); router.replace('/login'); }} className="text-white/70 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
          {/* Texniki band (mono etiketlər) */}
          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 lg:px-8">
              <span className="truncate">◇ {title}</span>
              <span className="hidden truncate sm:inline">{season}</span>
              <span>ISSUE / {issue}</span>
            </div>
          </div>
          {/* Jurnal seçici */}
          {catalogs.length > 1 && (
            <div className="border-t border-white/10">
              <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-4 py-2 lg:px-8">
                {catalogs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'shrink-0 rounded-full border px-3.5 py-1 text-xs font-medium transition-all',
                      active?.id === c.id ? 'border-[#5B5BF5] bg-[#5B5BF5]/20 text-white shadow-[0_0_18px_rgba(91,91,245,0.35)]' : 'border-white/15 text-white/55 hover:border-white/30 hover:text-white',
                    )}
                  >
                    {c.title?.az}{c.status !== 'published' ? ' · qaralama' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {isDraftPreview && (
          <div className="border-b border-amber-400/20 bg-amber-400/10 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-amber-200">
            ⚠ Önizləmə — bu jurnal hələ dərc olunmayıb
          </div>
        )}

        {isLoading ? (
          <div className="mx-auto max-w-[1500px] px-4 py-16 lg:px-8"><div className="h-[70vh] animate-pulse rounded-3xl border border-white/10 bg-white/5" /></div>
        ) : ordered.length === 0 ? (
          <p className="py-40 text-center font-mono text-sm uppercase tracking-widest text-white/40">
            {catalogs.length === 0 ? 'Hələ dərc olunmuş jurnal yoxdur' : 'Bu jurnalda model yoxdur'}
          </p>
        ) : (
          <>
            {/* COVER — futuristik hero */}
            {cover && (
              <section className="relative">
                <div className="relative h-[88vh] min-h-[560px] w-full overflow-hidden">
                  {coverImgs.length > 0 ? (
                    <Slideshow images={coverImgs} alt={cover.name?.az ?? ''} interval={5000} dots={coverImgs.length > 1} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0b0d1f] via-[#13152e] to-[#1a0f2e]">
                      <span className={cn(serif.className, 'select-none text-[30vw] font-black leading-none text-white/[0.06]')}>UP</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06070f] via-[#06070f]/40 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#06070f]/80 via-transparent to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1500px] p-6 lg:p-16">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/70 backdrop-blur-md">
                      <Sparkles className="h-3 w-3 text-[#7c7cf8]" /> Cover Story · {season}
                    </div>
                    <h1 className={cn(serif.className, 'mt-4 max-w-4xl text-5xl font-bold leading-[0.92] tracking-tight lg:text-8xl')}>
                      {cover.name?.az}
                    </h1>
                    {subtitle && <p className="mt-4 max-w-xl text-sm text-white/65 lg:text-base">{subtitle}</p>}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-[#5B5BF5]/40 bg-[#5B5BF5]/15 px-4 py-1.5 text-base font-semibold backdrop-blur-md">{formatCurrency(cover.wholesalePrice, 'AZN')}</span>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">{cover.fit ? PRODUCT_FITS[cover.fit] : ''}{cover.colorName ? ` · ${cover.colorName}` : ''}{cover.washEffect ? ` · ${cover.washEffect}` : ''}</span>
                      <button onClick={() => openProduct(cover)} className="group ml-1 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#06070f] shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all hover:shadow-[0_0_40px_rgba(124,124,248,0.6)]">
                        Modeli aç <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 rotate-90 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30 lg:block">Scroll ↓</div>
                </div>
              </section>
            )}

            {/* EDITORIAL — neon nömrəli spreadlər */}
            {editorials.length > 0 && (
              <section className="mx-auto max-w-[1500px] px-4 py-20 lg:px-8 lg:py-28">
                {editorials.map((p, idx) => {
                  const pImgs = imgs(p);
                  const reverse = idx % 2 === 1;
                  return (
                    <article key={p.id} className="mb-24 grid grid-cols-1 items-center gap-8 lg:mb-32 lg:grid-cols-2 lg:gap-16">
                      <div className={cn('group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10', reverse && 'lg:order-2')}>
                        <div className="pointer-events-none absolute -inset-px z-10 rounded-3xl ring-1 ring-inset ring-white/10 transition-all group-hover:ring-[#5B5BF5]/50 group-hover:shadow-[inset_0_0_60px_rgba(91,91,245,0.15)]" />
                        {pImgs.length > 0 ? (
                          <Slideshow images={pImgs} alt={p.name?.az ?? ''} interval={4000 + idx * 600} dots={pImgs.length > 1} />
                        ) : (
                          <div className={cn('flex h-full w-full items-center justify-center p-8', PANELS[idx % PANELS.length])}>
                            <span className={cn(serif.className, 'text-center text-4xl font-bold italic leading-tight text-white')}>{p.name?.az}</span>
                          </div>
                        )}
                      </div>
                      <div className={cn(reverse && 'lg:order-1')}>
                        <span className={cn(serif.className, 'bg-gradient-to-br from-[#7c7cf8] to-[#9333ea] bg-clip-text text-7xl font-black text-transparent')}>{String(idx + 1).padStart(2, '0')}</span>
                        <h2 className={cn(serif.className, 'mt-2 text-4xl font-bold leading-tight lg:text-5xl')}>{p.name?.az}</h2>
                        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#7c7cf8]">
                          {p.fit ? PRODUCT_FITS[p.fit] : ''}{p.colorName ? ` — ${p.colorName}` : ''}{p.weight ? ` — ${p.weight}` : ''}
                        </p>
                        {p.description?.az && <p className="mt-5 max-w-md leading-relaxed text-white/60">{p.description.az}</p>}
                        <div className="mt-7 flex items-center gap-4">
                          <span className="text-2xl font-bold">{formatCurrency(p.wholesalePrice, 'AZN')}</span>
                          {p.retailPrice > 0 && <span className="text-sm text-white/40 line-through">{formatCurrency(p.retailPrice, 'AZN')}</span>}
                          <button onClick={() => openProduct(p)} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium transition-all hover:border-[#5B5BF5]/60 hover:bg-[#5B5BF5]/10">
                            Bax <ArrowDownRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {/* LOOKBOOK — neon glass grid */}
            <section id="lookbook" className="border-t border-white/10 py-20 lg:py-28">
              <div className="mx-auto max-w-[1500px] px-4 lg:px-8">
                <div className="mb-12 flex items-end justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#7c7cf8]">{'// Bütün modellər'}</p>
                    <h2 className={cn(serif.className, 'mt-2 text-5xl font-bold lg:text-7xl')}>Lookbook</h2>
                  </div>
                  <span className="hidden font-mono text-xs uppercase tracking-widest text-white/35 sm:block">{ordered.length} model</span>
                </div>
                <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
                  {ordered.map((p, i) => {
                    const pImgs = imgs(p);
                    const variants = variantsByProduct.get(p.id) ?? [];
                    const aspect = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[3/4]'][i % 4];
                    return (
                      <button key={p.id} onClick={() => openProduct(p)} className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 text-left transition-all duration-300 hover:border-[#5B5BF5]/50 hover:shadow-[0_0_40px_rgba(91,91,245,0.25)]">
                        <div className={cn('relative w-full overflow-hidden', aspect)}>
                          {pImgs.length > 0 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pImgs[0]} alt={p.name?.az ?? ''} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          ) : (
                            <div className={cn('flex h-full w-full items-center justify-center p-6', PANELS[i % PANELS.length])}>
                              <span className={cn(serif.className, 'text-center text-2xl font-bold italic leading-tight text-white')}>{p.name?.az}</span>
                            </div>
                          )}
                          {pImgs.length > 1 && (
                            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md">
                              <Images className="h-3 w-3" /> {pImgs.length}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#06070f] via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-90" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          <p className="text-sm font-semibold">{p.name?.az}</p>
                          <p className="font-mono text-xs text-[#7c7cf8]">{formatCurrency(p.wholesalePrice, 'AZN')}{variants.length === 0 ? ' · tezliklə' : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="border-t border-white/10 py-12 text-center">
          <span className={cn(serif.className, 'text-2xl font-bold italic')}>UP <span className="text-[#7c7cf8]">Denim</span> Journal</span>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-white/35">{new Date().getFullYear()} · Premium B2B Denim · UP ERP</p>
        </footer>
      </div>

      {/* Məhsul detalı — qalereya + variantlar */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className={cn(grotesk.className, 'max-w-3xl border-white/10 bg-[#0a0c16] p-0 text-white')}>
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-white/5 p-4">
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-[#06070f]">
                  {selImages[activeImg] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selImages[activeImg]} alt={selected.name?.az ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn('flex h-full w-full items-center justify-center p-6', PANELS[0])}>
                      <span className={cn(serif.className, 'text-center text-3xl font-bold italic text-white')}>{selected.name?.az}</span>
                    </div>
                  )}
                </div>
                {selImages.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {selImages.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="" onClick={() => setActiveImg(i)} className={cn('h-16 w-12 shrink-0 cursor-pointer rounded-lg object-cover ring-2 transition', i === activeImg ? 'ring-[#5B5BF5]' : 'ring-transparent opacity-60 hover:opacity-100')} />
                    ))}
                  </div>
                )}
              </div>

              <div className="max-h-[80vh] overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className={cn(serif.className, 'text-3xl text-white')}>{selected.name?.az}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c7cf8]">
                  {selected.fit ? PRODUCT_FITS[selected.fit] : ''}{selected.colorName ? ` · ${selected.colorName}` : ''}{selected.weight ? ` · ${selected.weight}` : ''}
                </p>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-2xl font-bold">{formatCurrency(selected.wholesalePrice, 'AZN')}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-white/45">topdan / ədəd</span>
                  {selected.retailPrice > 0 && <span className="text-sm text-white/40 line-through">{formatCurrency(selected.retailPrice, 'AZN')}</span>}
                </div>
                {selected.description?.az && <p className="mt-4 leading-relaxed text-white/60">{selected.description.az}</p>}

                <div className="mt-6">
                  <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Mövcud ölçülər</p>
                  {selVariants.length === 0 ? (
                    <p className="text-sm text-white/45">Hazırda stokda variant yoxdur.</p>
                  ) : (
                    <div className="space-y-2">
                      {selVariants.map((v) => {
                        const qty = qtyByVariant[v.id] ?? 1;
                        return (
                          <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <div>
                              <p className="text-sm font-semibold">{v.size} <span className="font-mono text-xs font-normal text-white/45">· Sort {v.grade}</span></p>
                              <p className="font-mono text-[11px] text-white/45">Mövcud: {v.availableStock}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10" onClick={() => setQtyByVariant((p) => ({ ...p, [v.id]: Math.max(1, (p[v.id] ?? 1) - 1) }))}><Minus className="h-3 w-3" /></button>
                              <span className="w-7 text-center text-sm tnum">{qty}</span>
                              <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10" onClick={() => setQtyByVariant((p) => ({ ...p, [v.id]: (p[v.id] ?? 1) + 1 }))}><Plus className="h-3 w-3" /></button>
                              <button className="ml-1 rounded-lg bg-gradient-to-br from-[#5B5BF5] to-[#9333ea] px-3 py-1.5 text-xs font-semibold shadow-[0_0_18px_rgba(91,91,245,0.4)] transition-transform hover:scale-105" onClick={() => addVariant(v, selected)}>Səbətə</button>
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
        <DialogContent className={cn(grotesk.className, 'max-w-md border-white/10 bg-[#0a0c16] text-white')}>
          <DialogHeader><DialogTitle className="text-white">Səbət</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/45">Səbət boşdur</p>
          ) : (
            <div className="space-y-3">
              {cart.map((i) => (
                <div key={i.finishedGoodId} className="flex items-center gap-2 text-sm">
                  <div className="flex-1"><p className="font-medium">{i.productName}</p><p className="font-mono text-xs text-white/45">{i.size}/{i.grade} · ×{i.quantity}</p></div>
                  <span className="font-medium tnum">{formatCurrency(i.lineTotal, 'AZN')}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-400 hover:bg-white/10" onClick={() => setCart(cart.filter((x) => x.finishedGoodId !== i.finishedGoodId))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-semibold"><span>Ara cəm</span><span className="tnum">{formatCurrency(cartTotal, 'AZN')}</span></div>
              <p className="font-mono text-[11px] text-white/40">ƏDV ({VAT_RATE}%) və endirim təsdiq zamanı hesablanacaq.</p>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B5BF5] to-[#9333ea] py-3 text-sm font-semibold shadow-[0_0_30px_rgba(91,91,245,0.45)] transition-transform hover:scale-[1.02] disabled:opacity-60" onClick={checkout} disabled={placing}>{placing && <Loader2 className="h-4 w-4 animate-spin" />} Sifarişi göndər</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
