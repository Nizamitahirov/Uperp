'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, Wallet } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createCashRegister, addCashTransaction } from '@/lib/firebase/cash';
import { useAuth } from '@/components/providers/auth-provider';
import type { CashRegister, CashTransaction } from '@/types';
import { CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES } from '@/lib/constants';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function CashPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [regOpen, setRegOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reg, setReg] = useState({ name: '', type: 'cash' as CashRegister['type'], currency: 'AZN' });
  const [tx, setTx] = useState({ registerId: '', type: 'in' as 'in' | 'out', category: '', amount: 0, description: '' });

  const canManage = can('cash', 'create');
  const { data: registers = [] } = useQuery({ queryKey: ['cash_registers'], queryFn: () => listDocs<CashRegister>('cash_registers', [orderBy('createdAt', 'desc')]) });
  const { data: transactions = [] } = useQuery({ queryKey: ['cash_transactions'], queryFn: () => listDocs<CashTransaction>('cash_transactions', [orderBy('createdAt', 'desc')]) });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const totalBalance = registers.reduce((s, r) => s + (r.currentBalance ?? 0), 0);

  async function saveRegister() {
    if (!reg.name) { toast.error('Ad daxil edin'); return; }
    setSubmitting(true);
    try {
      await createCashRegister(reg, actor);
      toast.success('Kassa yaradıldı');
      setRegOpen(false); setReg({ name: '', type: 'cash', currency: 'AZN' });
      qc.invalidateQueries({ queryKey: ['cash_registers'] });
    } catch { toast.error('Yaradılmadı'); } finally { setSubmitting(false); }
  }

  async function saveTx() {
    if (!tx.registerId || !tx.category || tx.amount <= 0) { toast.error('Bütün sahələri doldurun'); return; }
    setSubmitting(true);
    try {
      const r = registers.find((x) => x.id === tx.registerId);
      await addCashTransaction({ ...tx, registerName: r?.name, currency: r?.currency ?? 'AZN' }, actor);
      toast.success('Əməliyyat əlavə edildi');
      setTxOpen(false); setTx({ registerId: '', type: 'in', category: '', amount: 0, description: '' });
      qc.invalidateQueries({ queryKey: ['cash_registers'] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSubmitting(false); }
  }

  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }
  const categories = tx.type === 'in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;

  return (
    <div>
      <PageHeader
        title="Kassa"
        subtitle="Nağd və bank vəsaitləri"
        action={
          <div className="flex gap-2">
            <ExportButton filename="kassa-emeliyyatlari" rows={transactions} columns={[
              { header: 'Tarix', value: (t) => formatDateTime(tsMillis(t.createdAt)) },
              { header: 'Kassa', value: (t) => t.registerName ?? '' },
              { header: 'Növ', value: (t) => (t.type === 'in' ? 'Daxilolma' : 'Çıxış') },
              { header: 'Kateqoriya', value: 'category' },
              { header: 'Məbləğ', value: 'amount' },
              { header: 'Valyuta', value: 'currency' },
              { header: 'Təsvir', value: (t) => t.description ?? '' },
            ]} />
            {canManage && <>
              <Button variant="outline" onClick={() => setRegOpen(true)}><Plus /> Kassa</Button>
              <Button onClick={() => setTxOpen(true)} disabled={registers.length === 0}><Plus /> Əməliyyat</Button>
            </>}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4" /><span className="text-xs">Ümumi balans</span></div><p className="mt-1 text-2xl font-bold">{formatCurrency(totalBalance, 'AZN')}</p></CardContent></Card>
        {registers.slice(0, 3).map((r) => (
          <Card key={r.id} className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{r.name}</p><p className="mt-1 text-xl font-bold">{formatCurrency(r.currentBalance ?? 0, r.currency)}</p><Badge variant="secondary" className="mt-1">{r.type}</Badge></CardContent></Card>
        ))}
      </div>

      <Card className="rounded-card">
        {transactions.length === 0 ? (
          <EmptyState title="Əməliyyat yoxdur" description="Kassa əməliyyatları burada görünəcək" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarix</TableHead>
                <TableHead>Kassa</TableHead>
                <TableHead>Kateqoriya</TableHead>
                <TableHead>Növ</TableHead>
                <TableHead className="text-right">Məbləğ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateTime(tsMillis(t.createdAt))}</TableCell>
                  <TableCell>{t.registerName}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell>
                    {t.type === 'in' ? <span className="flex items-center gap-1 text-success"><ArrowDownCircle className="h-4 w-4" /> Mədaxil</span> : <span className="flex items-center gap-1 text-danger"><ArrowUpCircle className="h-4 w-4" /> Məxaric</span>}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${t.type === 'in' ? 'text-success' : 'text-danger'}`}>{t.type === 'in' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yeni kassa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Ad</Label><Input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Əsas kassa" /></div>
            <div className="space-y-1.5"><Label>Növ</Label>
              <Select value={reg.type} onValueChange={(v) => setReg({ ...reg, type: v as CashRegister['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Nağd</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="pos_terminal">POS terminal</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Valyuta</Label><Input value={reg.currency} onChange={(e) => setReg({ ...reg, currency: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRegOpen(false)}>Ləğv</Button><Button onClick={saveRegister} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Yarat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kassa əməliyyatı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Kassa</Label>
              <Select value={tx.registerId} onValueChange={(v) => setTx({ ...tx, registerId: v })}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({formatCurrency(r.currentBalance ?? 0, r.currency)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={tx.type === 'in' ? 'default' : 'outline'} size="sm" onClick={() => setTx({ ...tx, type: 'in', category: '' })}>Mədaxil</Button>
              <Button variant={tx.type === 'out' ? 'default' : 'outline'} size="sm" onClick={() => setTx({ ...tx, type: 'out', category: '' })}>Məxaric</Button>
            </div>
            <div className="space-y-1.5"><Label>Kateqoriya</Label>
              <Select value={tx.category} onValueChange={(v) => setTx({ ...tx, category: v })}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Məbləğ</Label><Input type="number" step="any" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: +e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Təsvir</Label><Input value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTxOpen(false)}>Ləğv</Button><Button onClick={saveTx} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Əlavə et</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
