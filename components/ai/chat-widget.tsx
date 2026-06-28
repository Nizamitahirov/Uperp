'use client';

import { useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2, Sparkles } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { aiPrompt } from '@/lib/ai/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { FinishedGoodStock, RawMaterial, SalesOrder } from '@/types';
import { getStockStatus } from '@/lib/utils/stock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

interface Msg {
  role: 'user' | 'ai';
  text: string;
}

/** Sistem datası əsasında qısa kontekst snapshot-u (RAG-lite, 12 §12.3) */
async function buildContext(): Promise<string> {
  try {
    const [materials, finished, sales] = await Promise.all([
      listDocs<RawMaterial>('raw_materials', []),
      listDocs<FinishedGoodStock>('finished_goods', []),
      listDocs<SalesOrder>('sales_orders', []),
    ]);
    const lowStock = materials.filter((m) => ['critical', 'out', 'low'].includes(getStockStatus(m))).map((m) => `${m.name}: ${m.currentStock} ${m.unit}`);
    const delivered = sales.filter((s) => s.status === 'delivered');
    const totalSales = delivered.reduce((a, s) => a + s.totalAmount, 0);
    const fgTotal = finished.reduce((a, f) => a + (f.currentStock ?? 0), 0);
    return [
      `Xam material sayı: ${materials.length}`,
      `Aşağı/kritik stok materiallar: ${lowStock.slice(0, 10).join('; ') || 'yoxdur'}`,
      `Hazır məhsul ümumi ədəd: ${fgTotal}`,
      `Çatdırılmış satış sayı: ${delivered.length}, ümumi məbləğ: ${totalSales.toFixed(0)} AZN`,
      `Aktiv sifariş: ${sales.filter((s) => ['new', 'confirmed', 'preparing'].includes(s.status)).length}`,
    ].join('\n');
  } catch {
    return 'Data əldə edilə bilmədi.';
  }
}

export function ChatWidget() {
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: 'Salam! Mən ERP köməkçinizəm. Stok, satış və ya istehsal haqqında soruşa bilərsiniz.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const contextRef = useRef<string | null>(null);

  if (!firebaseUser) return null;

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      if (!contextRef.current) contextRef.current = await buildContext();
      const answer = await aiPrompt(
        `Sən cins şalvar istehsalı ERP sisteminin köməkçisisən. Yalnız aşağıdakı data əsasında Azərbaycan dilində dəqiq cavab ver. Data yoxdursa bunu bildir.\n\nKONTEKST:\n${contextRef.current}\n\nSUAL: ${q}`,
      );
      setMessages((m) => [...m, { role: 'ai', text: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: 'Bağışlayın, cavab ala bilmədim. (AI servisi əlçatan deyil)' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="AI köməkçi"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[90] flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-card border bg-background shadow-xl">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Köməkçi (Groq)</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-card px-3 py-2 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> AI düşünür...</div>}
          </div>
          <div className="flex gap-2 border-t p-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Sual yazın..." />
            <Button size="icon" onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </>
  );
}
