'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  images: string[];
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Avtomatik dəyişmə intervalı (ms). 0 = avtomatik söndür */
  interval?: number;
  /** Nöqtə naviqasiyasını göstər */
  dots?: boolean;
}

/** Moda jurnalı üçün çoxlu şəkilli slideshow — avtomatik fade + nöqtələr */
export function Slideshow({ images, alt, className, imgClassName, interval = 3500, dots = true }: Props) {
  const [idx, setIdx] = useState(0);
  const valid = images.filter(Boolean);

  useEffect(() => {
    if (valid.length <= 1 || interval <= 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % valid.length), interval);
    return () => clearInterval(t);
  }, [valid.length, interval]);

  // Şəkil sayı dəyişərsə indeksi sıfırla
  useEffect(() => {
    setIdx(0);
  }, [valid.length]);

  if (valid.length === 0) return null;

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      {valid.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url + i}
          src={url}
          alt={alt}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000',
            i === idx ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      ))}
      {dots && valid.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Şəkil ${i + 1}`}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={cn(
                'h-1.5 rounded-full bg-white/60 transition-all',
                i === idx ? 'w-5 bg-white' : 'w-1.5 hover:bg-white/90',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
