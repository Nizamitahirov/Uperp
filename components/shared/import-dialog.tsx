'use client';

import { useRef, useState } from 'react';
import { Download, FileUp, Loader2, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseSpreadsheet, downloadTemplate } from '@/lib/utils/import';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

export interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  /** Şablon başlıqları (ilk sətir) */
  headers: string[];
  /** Məcburi başlıqlar */
  required?: string[];
  templateName: string;
  /** Sətirləri sistemə yazır */
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onDone?: () => void;
}

export function ImportDialog({ open, onOpenChange, title, headers, required = [], templateName, onImport, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const missing = rows.length > 0 ? required.filter((h) => !Object.keys(rows[0]).includes(h)) : [];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true); setResult(null);
    try {
      const parsed = await parseSpreadsheet(file);
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length === 0) toast.error('Fayl boşdur və ya oxunmadı');
    } catch (e) {
      toast.error('Fayl oxunmadı', e instanceof Error ? e.message : undefined);
    } finally { setParsing(false); }
  }

  async function run() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.created > 0) { toast.success(`${res.created} qeyd import edildi`); onDone?.(); }
      if (res.created === 0 && res.failed > 0) toast.error('Heç bir qeyd import edilmədi');
    } catch (e) {
      toast.error('İmport alınmadı', e instanceof Error ? e.message : undefined);
    } finally { setImporting(false); }
  }

  function reset() { setRows([]); setFileName(''); setResult(null); }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> {title}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateName, headers)}><Download className="h-4 w-4" /> Nümunə şablon</Button>
            <span className="text-xs text-muted-foreground">Başlıqlar: {headers.join(', ')}</span>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm transition-colors', dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50')}
          >
            {parsing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
            <p className="font-medium">{fileName || 'Excel/CSV faylı seçin və ya buraya atın'}</p>
            <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          {missing.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> Çatışmayan sütun(lar): {missing.join(', ')}</p>
          )}

          {rows.length > 0 && !result && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{rows.length} sətir tapıldı — ilk {Math.min(5, rows.length)} önizləmə:</p>
              <div className="max-h-52 overflow-auto rounded-xl border border-border">
                <Table>
                  <TableHeader><TableRow>{headers.map((h) => <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>{headers.map((h) => <TableCell key={h} className="whitespace-nowrap text-xs">{r[h] || '—'}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {result.created} qeyd yaradıldı</p>
              {result.failed > 0 && <p className="flex items-center gap-1.5 font-medium text-rose-600"><AlertTriangle className="h-4 w-4" /> {result.failed} sətir keçilmədi</p>}
              {result.errors.slice(0, 6).map((e, i) => <p key={i} className="pl-5 text-xs text-muted-foreground">• {e}</p>)}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{result ? 'Bağla' : 'Ləğv'}</Button>
          {!result && <Button onClick={run} disabled={rows.length === 0 || importing || missing.length > 0}>{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} İmport et</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
