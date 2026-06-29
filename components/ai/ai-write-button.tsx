'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { aiPrompt } from '@/lib/ai/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** AI-yə göndəriləcək tam prompt (çağırış anında qurulur) */
  buildPrompt: () => string;
  /** Nəticə mətni callback */
  onResult: (text: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Hər hansı mətn sahəsini AI ilə doldurmaq üçün kiçik düymə (Groq) */
export function AiWriteButton({ buildPrompt, onResult, label = 'AI ilə yaz', className, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const text = await aiPrompt(buildPrompt());
      onResult(text.trim());
      toast.success('AI mətn yaradıldı');
    } catch (e) {
      toast.error('AI mətn alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={run}
      disabled={loading || disabled}
      className={cn('gap-1.5 border-primary/30 text-primary hover:bg-primary/10', className)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
