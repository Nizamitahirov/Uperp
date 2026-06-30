'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookOpen, Loader2, Sparkles, X } from 'lucide-react';
import { getCountFromServer, collection } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { explainPage } from '@/lib/ai/client';
import { findGuide } from '@/lib/page-guide';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function PageGuide() {
  const pathname = usePathname();
  const guide = findGuide(pathname);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<{ az: string; en: string } | null>(null);
  const [lang, setLang] = useState<'az' | 'en'>('az');

  // Səhifə dəyişəndə hər şeyi sıfırla — hər səhifə üçün yenidən başlasın
  useEffect(() => {
    setOpen(false);
    setAi(null);
    setLoading(false);
    setLang('az');
  }, [pathname]);

  if (!guide) return null;
  const { meta } = guide;

  async function runAi() {
    setLoading(true);
    try {
      let dataCount: number | undefined;
      if (meta.collection) {
        try {
          const snap = await getCountFromServer(collection(getDb(), meta.collection));
          dataCount = snap.data().count;
        } catch { /* ignore */ }
      }
      const r = await explainPage({
        title: meta.title, purpose: meta.purpose, how: meta.how,
        prevStep: meta.prev, nextStep: meta.next, affects: meta.affects,
        dataCount, route: guide!.route,
      });
      setAi(r);
    } catch {
      setAi({ az: 'AI izahı alınmadı. Yenidən cəhd edin.', en: 'AI explanation failed.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Topbar trigger — sabit, normal yer */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-button border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        title="AI Bələdçi — bu səhifə haqqında"
        aria-label="AI bələdçi"
      >
        <Sparkles className="h-3.5 w-3.5" /> <span className="hidden lg:inline">AI Bələdçi</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-soft-lg animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-button bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-semibold">AI Bələdçi</p>
                  <p className="text-xs text-muted-foreground">{meta.title}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {/* Statik strukturlu bələdçi */}
              <Section title="Bu səhifə nədir?">
                <p className="text-sm leading-relaxed text-muted-foreground">{meta.purpose}</p>
              </Section>

              <Section title="Necə istifadə olunur?">
                <ol className="space-y-1.5">
                  {meta.how.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="İş axınında yeri">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-button border border-border px-2 py-1 text-muted-foreground">{meta.prev || '—'}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="rounded-button border border-primary/40 bg-primary/10 px-2 py-1 font-medium text-primary">{meta.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="rounded-button border border-border px-2 py-1 text-muted-foreground">{meta.next || '—'}</span>
                </div>
              </Section>

              {meta.affects && (
                <Section title="Nəyə təsir edir?">
                  <p className="text-sm leading-relaxed text-muted-foreground">{meta.affects}</p>
                </Section>
              )}

              {/* AI hekayə izahı */}
              <div className="rounded-card border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> AI ətraflı izah</span>
                  {ai && (
                    <div className="flex gap-1">
                      {(['az', 'en'] as const).map((l) => (
                        <button key={l} onClick={() => setLang(l)} className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>{l.toUpperCase()}</button>
                      ))}
                    </div>
                  )}
                </div>
                {ai ? (
                  <Markdown text={lang === 'az' ? ai.az : ai.en} />
                ) : (
                  <Button size="sm" className="w-full" onClick={runAi} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI ilə hekayə şəklində izah et
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Yüngül markdown renderer (### başlıq, nömrəli/madde siyahı, **bold**) */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const t = line.trim();
        if (t.startsWith('### ')) return <p key={i} className="pt-1 text-xs font-bold uppercase tracking-wide text-primary">{t.slice(4)}</p>;
        if (t.startsWith('## ')) return <p key={i} className="pt-1 text-sm font-bold">{t.slice(3)}</p>;
        const bullet = /^(\d+\.|[-*•])\s+/.exec(t);
        const content = bullet ? t.slice(bullet[0].length) : t;
        const html = content.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        return (
          <p key={i} className={cn('text-muted-foreground', bullet && 'pl-3')}>
            {bullet && <span className="mr-1.5 text-primary">{bullet[1].includes('.') ? bullet[1] : '•'}</span>}
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </p>
        );
      })}
    </div>
  );
}
