'use client';

import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/** "Hamısı" (filtrsiz) sentinel dəyəri */
export const ALL = 'all';

export interface FilterOption {
  value: string;
  label: string;
}

export interface SelectFilterDef {
  /** Unikal açar */
  key: string;
  /** Seçilməmiş halda göstərilən mətn */
  placeholder: string;
  /** Cari dəyər (ALL = filtrsiz) */
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  /** "Hamısı" seçiminin etiketi */
  allLabel?: string;
  className?: string;
}

interface Props {
  /** Axtarış mətni (verilməzsə axtarış qutusu göstərilmir) */
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: SelectFilterDef[];
  /** Sağ tərəfdə əlavə (məs. İxrac düyməsi) */
  right?: ReactNode;
  className?: string;
}

/** Siyahı səhifələri üçün standart filtr paneli — axtarış + select filtrləri + sağ slot */
export function FilterBar({ search, onSearch, searchPlaceholder = 'Axtar...', filters = [], right, className }: Props) {
  const activeCount = filters.filter((f) => f.value !== ALL).length + (search ? 1 : 0);

  function clearAll() {
    onSearch?.('');
    filters.forEach((f) => f.onChange(ALL));
  }

  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {onSearch && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={searchPlaceholder} value={search ?? ''} onChange={(e) => onSearch(e.target.value)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Select key={f.key} value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className={cn('h-9 w-auto min-w-[9rem] gap-1', f.value !== ALL && 'border-primary/50 text-primary', f.className)}>
              <SelectValue placeholder={f.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.allLabel ?? f.placeholder}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Təmizlə
          </Button>
        )}
      </div>

      {right && <div className="flex items-center gap-2 sm:ml-auto">{right}</div>}
    </div>
  );
}
