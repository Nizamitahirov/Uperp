'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { recordCustomerPayment, payPayable } from '@/lib/firebase/finance';
import { useAuth } from '@/components/providers/auth-provider';
import type { CashRegister, Payable, Receivable } from '@/types';
import { ARAP_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

function agingBucket(dueMs?: number): string {
  if (!dueMs) return '—';
  const days = Math.floor((Date.now() - dueMs) / (24 * 3600 * 1000));
  if (days <= 0) return 'Cari';
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export default function FinancePage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [arTarget, setArTarget] = useState<Receivable | null>(null);
  const [apTarget, setApTarget] = useState<Payable | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('transfer');
  const [registerId, setRegisterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = can('finance', 'create') || can('receivables', 'update');
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => listDocs<Receivable>('receivables', [orderBy('createdAt', 'desc')]) });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => listDocs<Payable>('payables', [orderBy('createdAt', 'desc')]) });
  const { data: registers = [] } = useQuery({ queryKey: ['cash_registers'], queryFn: () => listDocs<CashRegister>('cash_registers', [where('isActive', '==', true)]) });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  const arTotal = useMemo(() => receivables.reduce((s, r) => s + (r.balance ?? 0), 0), [receivables]);
  const apTotal = useMemo(() => payables.reduce((s, p) => s + (p.balance ?? 0), 0), [payables]);

  async function submitAR() {
    if (!arTarget || amount <= 0) return;
    setSubmitting(true);
    try {
      const reg = registers.find((r) => r.id === registerId);
      await recordCustomerPayment(arTarget, { amount, method, registerId: registerId || undefined, registerName: reg?.name }, actor);
      toast.success('Ödəniş qeydə alındı');
      setArTarget(null); setAmount(0);
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['cash_registers'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSubmitting(false); }
  }

  async function submitAP() {
    if (!apTarget || amount <= 0) return;
    setSubmitting(true);
    try {
      const reg = registers.find((r) => r.id === registerId);
      await payPayable(apTarget, { amount, registerId: registerId || undefined, registerName: reg?.name }, actor);
      toast.success('Ödəniş edildi');
      setApTarget(null); setAmount(0);
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['cash_registers'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSubmitting(false); }
  }

  return (
    <div>
      <PageHeader title="Maliyyə" subtitle="Debitor (AR) və Kreditor (AP) idarəsi" />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Debitor (alınacaq)</p><p className="mt-1 text-2xl font-bold text-success">{formatCurrency(arTotal, 'AZN')}</p></CardContent></Card>
        <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Kreditor (ödəniləcək)</p><p className="mt-1 text-2xl font-bold text-danger">{formatCurrency(apTotal, 'AZN')}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar">Debitor (AR)</TabsTrigger>
          <TabsTrigger value="ap">Kreditor (AP)</TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <Card className="rounded-card">
            {receivables.length === 0 ? <EmptyState title="Debitor yoxdur" description="Çatdırılmış sifarişlərdən yaranır" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Müştəri</TableHead><TableHead>Faktura</TableHead><TableHead>Ödəniş tarixi</TableHead><TableHead>Aging</TableHead>
                  <TableHead className="text-right">Qalıq</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {receivables.map((r) => {
                    const meta = ARAP_STATUS_META[r.status] ?? ARAP_STATUS_META.open;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.customerName}</TableCell>
                        <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(tsMillis(r.dueDate))}</TableCell>
                        <TableCell>{agingBucket(tsMillis(r.dueDate))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.balance, 'AZN')}</TableCell>
                        <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        {canManage && <TableCell>{r.balance > 0 && <Button size="sm" variant="outline" onClick={() => { setArTarget(r); setAmount(r.balance); }}>Ödəniş</Button>}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="ap">
          <Card className="rounded-card">
            {payables.length === 0 ? <EmptyState title="Kreditor yoxdur" description="GRN qəbullarından yaranır" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Təchizatçı</TableHead><TableHead>Ödəniş tarixi</TableHead>
                  <TableHead className="text-right">Qalıq</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {payables.map((p) => {
                    const meta = ARAP_STATUS_META[p.status] ?? ARAP_STATUS_META.open;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.supplierName}</TableCell>
                        <TableCell>{formatDate(tsMillis(p.dueDate))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.balance, 'AZN')}</TableCell>
                        <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        {canManage && <TableCell>{p.balance > 0 && <Button size="sm" variant="outline" onClick={() => { setApTarget(p); setAmount(p.balance); }}>Ödə</Button>}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* AR ödəniş dialoqu */}
      <Dialog open={!!arTarget} onOpenChange={(o) => !o && setArTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Müştəri ödənişi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{arTarget?.customerName} · qalıq {formatCurrency(arTarget?.balance ?? 0, 'AZN')}</p>
            <div className="space-y-1.5"><Label>Məbləğ</Label><Input type="number" step="any" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Üsul</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Nağd</SelectItem><SelectItem value="transfer">Köçürmə</SelectItem><SelectItem value="card">Kart</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Kassa (opsional)</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setArTarget(null)}>Ləğv</Button><Button onClick={submitAR} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Qeyd et</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AP ödəniş dialoqu */}
      <Dialog open={!!apTarget} onOpenChange={(o) => !o && setApTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Təchizatçıya ödəniş</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{apTarget?.supplierName} · qalıq {formatCurrency(apTarget?.balance ?? 0, 'AZN')}</p>
            <div className="space-y-1.5"><Label>Məbləğ</Label><Input type="number" step="any" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Kassa (opsional)</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setApTarget(null)}>Ləğv</Button><Button onClick={submitAP} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Ödə</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
