'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadFile, deleteFileByUrl } from '@/lib/firebase/storage';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

/** Çoxlu şəkil upload (drag-drop + Firebase Storage) — 10 §10.2 */
export function ImageUpload({
  path,
  value,
  onChange,
  max = 6,
}: {
  path: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error(`Maksimum ${max} şəkil`);
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of toUpload) {
        if (!f.type.startsWith('image/')) continue;
        urls.push(await uploadFile(path, f));
      }
      onChange([...value, ...urls]);
      toast.success(`${urls.length} şəkil yükləndi`);
    } catch (e) {
      toast.error('Yükləmə alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function remove(url: string) {
    onChange(value.filter((u) => u !== url));
    await deleteFileByUrl(url);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-card border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={cn(
              'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-card border border-dashed text-xs text-muted-foreground transition-colors hover:bg-accent',
              dragOver && 'border-primary bg-accent',
            )}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? 'Yüklənir' : 'Şəkil'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}
