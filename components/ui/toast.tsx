'use client';

import { create } from 'zustand';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastVariant = 'default' | 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Sadə toast helper-i — istənilən yerdən çağırıla bilər */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'info' }),
};

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES: Record<ToastVariant, string> = {
  default: 'border-border',
  success: 'border-l-4 border-l-success',
  error: 'border-l-4 border-l-danger',
  info: 'border-l-4 border-l-info',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn('flex items-start gap-3 rounded-card border bg-background p-4 shadow-lg', STYLES[t.variant])}
          >
            <Icon
              className={cn(
                'mt-0.5 h-5 w-5 shrink-0',
                t.variant === 'success' && 'text-success',
                t.variant === 'error' && 'text-danger',
                t.variant === 'info' && 'text-info',
              )}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
