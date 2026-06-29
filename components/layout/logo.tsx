import { cn } from '@/lib/utils/cn';

/** UP ERP wordmark — mərkəzi loqo komponenti (rebranding üçün tək nöqtə) */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-primary-foreground">
        UP
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight text-foreground">ERP</span>}
    </span>
  );
}
