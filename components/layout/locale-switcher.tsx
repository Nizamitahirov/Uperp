'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function setLocale(next: string) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Dil">
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('az')} className={locale === 'az' ? 'font-semibold' : ''}>
          🇦🇿 Azərbaycanca
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('en')} className={locale === 'en' ? 'font-semibold' : ''}>
          🇬🇧 English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
