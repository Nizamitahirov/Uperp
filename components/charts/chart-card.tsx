'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { explainChart } from '@/lib/ai/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface Props {
  title: string;
  /** AI üçün qrafik tipi — məs. "line", "donut", "radar", "combo" */
  type: string;
  /** AI-yə göndəriləcək data (sərlövhəli array) */
  data: unknown;
  /** Əlavə kontekst (məs. "AZN, son 6 ay") */
  context?: string;
  /** Başlıqda sağda əlavə element (məs. legend, filter) */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Qrafik üçün konteyner — başlıq + "AI ilə izah / Explain (AI)" düyməsi (AZ/EN) */
export function ChartCard({ title, type, data, context, action, className, children }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ az: string; en: string } | null>(null);
  const [lang, setLang] = useState<'az' | 'en'>('az');

  async function explain() {
    setLoading(true);
    try {
      const r = await explainChart({ title, type, data, context });
      setResult(r);
    } catch {
      setResult({ az: 'AI izahı alınmadı. Yenidən cəhd edin.', en: 'AI explanation failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={cn('rounded-card', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {action}
          <Button
            variant="outline"
            size="sm"
            onClick={explain}
            disabled={loading}
            title="AI ilə izah / Explain with AI"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">AI izah</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {children}

        {result && (
          <div className="mt-3 rounded-card border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI İzah
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLang('az')}
                  className={cn('rounded px-2 py-0.5 text-[11px] font-semibold transition-colors', lang === 'az' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
                >AZ</button>
                <button
                  onClick={() => setLang('en')}
                  className={cn('rounded px-2 py-0.5 text-[11px] font-semibold transition-colors', lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
                >EN</button>
                <button onClick={() => setResult(null)} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Bağla"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{lang === 'az' ? result.az : result.en}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
