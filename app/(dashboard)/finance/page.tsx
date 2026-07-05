'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import Link from 'next/link';
import { Loader2, Wallet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { listDocs } from '@/lib/firebase/firestore';
import { recordCustomerPayment, payPayable, createExpense, setExpenseStatus } from '@/lib/firebase/finance';
import { useAuth } from '@/components/providers/auth-provider';
import type { CashRegister, Expense, ExpenseCategory, Payable, Receivable } from '@/types';
import { ARAP_STATUS_META, EXPENSE_CATEGORIES } from '@/lib/constants';
import { buildAging } from '@/lib/utils/aging';
import { cn } from '@/lib/utils/cn';
import { ChartCard } from '@/components/charts/chart-card';
import { AiWriteButton } from '@/components/ai/ai-write-button';
import { ExportButton } from '@/components/shared/export-button';
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
  const [expOpen, setExpOpen] = useState(false);
  const [exp, setExp] = useState({ category: 'other' as ExpenseCategory, amount: 0, paymentMethod: 'cash', description: '' });

  const canManage = can('finance', 'create') || can('receivables', 'update');
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => listDocs<Receivable>('receivables', [orderBy('createdAt', 'desc')]) });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => listDocs<Payable>('payables', [orderBy('createdAt', 'desc')]) });
  const { data: registers = [] } = useQuery({ queryKey: ['cash_registers'], queryFn: () => listDocs<CashRegister>('cash_registers', [where('isActive', '==', true)]) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => listDocs<Expense>('expenses', [orderBy('createdAt', 'desc')]) });

  async function saveExpense() {
    if (exp.amount <= 0) { toast.error('Məbləğ daxil edin'); return; }
    setSubmitting(true);
    try {
      await createExpense({ ...exp, currency: 'AZN' }, actor);
      toast.success('Xərc əlavə edildi');
      setExpOpen(false); setExp({ category: 'other', amount: 0, paymentMethod: 'cash', description: '' });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    } catch { toast.error('Alınmadı'); } finally { setSubmitting(false); }
  }
  async function approveExpense(e: Expense) {
    await setExpenseStatus(e.id, e.approvalStatus === 'submitted' ? 'approved' : 'paid', actor);
    qc.invalidateQueries({ queryKey: ['expenses'] });
  }

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  const arTotal = useMemo(() => receivables.reduce((s, r) => s + (r.balance ?? 0), 0), [receivables]);
  const apTotal = useMemo(() => payables.reduce((s, p) => s + (p.balance ?? 0), 0), [payables]);

  const agingCompare = useMemo(() => {
    const ar = buildAging(receivables.map((r) => ({ id: r.id, name: r.customerName ?? r.id, balance: r.balance, dueDate: r.dueDate })));
    const ap = buildAging(payables.map((p) => ({ id: p.id, name: p.supplierName ?? p.id, balance: p.balance, dueDate: p.dueDate })));
    return ar.buckets.map((b, i) => ({ name: b.name, Debitor: Math.round(b.value), Kreditor: Math.round(ap.buckets[i]?.value ?? 0) }));
  }, [receivables, payables]);

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
      <PageHeader title="Maliyyə" subtitle="Debitor (AR) və Kreditor (AP) idarəsi" action={
        <Button variant="outline" asChild><Link href="/cash"><Wallet className="h-4 w-4" /> Kassa</Link></Button>
      } />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* Xalis mövqe (net position) */}
        <Card className="rounded-card">
          <CardContent className="flex h-full flex-col justify-center gap-3 p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Xalis mövqe (AR − AP)</p>
              <p className={cn('mt-1 text-3xl font-bold tracking-tight', arTotal - apTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {formatCurrency(arTotal - apTotal, 'AZN')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-xl border border-border bg-[#5B5BF5]/[0.06] p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className="h-2 w-2 rounded-full bg-[#5B5BF5]" /> Debitor</span>
                <p className="mt-1 text-lg font-bold text-[#5B5BF5]">{formatCurrency(arTotal, 'AZN')}</p>
              </div>
              <div className="rounded-xl border border-border bg-rose-500/[0.06] p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className="h-2 w-2 rounded-full bg-rose-500" /> Kreditor</span>
                <p className="mt-1 text-lg font-bold text-rose-500">{formatCurrency(apTotal, 'AZN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Yaş qrupları — müasir horizontal müqayisə */}
        <ChartCard className="lg:col-span-2" title="Debitor vs Kreditor — yaş qrupları" type="grouped bar" data={agingCompare} context="AZN, AR (alınacaq) və AP (ödəniləcək) yaş qrupları üzrə müqayisə"
          action={
            <div className="hidden items-center gap-3 text-[11px] font-medium text-muted-foreground sm:flex">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#5B5BF5]" /> Debitor</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Kreditor</span>
            </div>
          }
        >
          {arTotal === 0 && apTotal === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Açıq borc yoxdur 🟢</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingCompare} layout="vertical" barGap={3} barCategoryGap="26%" margin={{ left: 8, right: 12 }}>
                <defs>
                  <linearGradient id="arGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7c6cf5" /><stop offset="100%" stopColor="#5B5BF5" /></linearGradient>
                  <linearGradient id="apGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#f43f5e" /></linearGradient>
                </defs>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} cursor={{ fill: 'rgba(91,91,245,0.06)' }} />
                <Bar name="Debitor" dataKey="Debitor" fill="url(#arGrad)" radius={[0, 5, 5, 0]} barSize={13} />
                <Bar name="Kreditor" dataKey="Kreditor" fill="url(#apGrad)" radius={[0, 5, 5, 0]} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar">Debitor (AR)</TabsTrigger>
          <TabsTrigger value="ap">Kreditor (AP)</TabsTrigger>
          <TabsTrigger value="exp">Xərclər</TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <div className="mb-2 flex justify-end">
            <ExportButton filename="debitor-ar" rows={receivables} columns={[
              { header: 'Müştəri', value: (r) => r.customerName ?? '' },
              { header: 'Faktura', value: (r) => r.invoiceNumber ?? '' },
              { header: 'Ödəniş tarixi', value: (r) => formatDate(tsMillis(r.dueDate)) },
              { header: 'Məbləğ', value: 'amount' },
              { header: 'Ödənilib', value: 'paidAmount' },
              { header: 'Qalıq', value: 'balance' },
              { header: 'Status', value: 'status' },
            ]} />
          </div>
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
          <div className="mb-2 flex justify-end">
            <ExportButton filename="kreditor-ap" rows={payables} columns={[
              { header: 'Təchizatçı', value: (p) => p.supplierName ?? '' },
              { header: 'Faktura', value: (p) => p.invoiceNumber ?? '' },
              { header: 'Ödəniş tarixi', value: (p) => formatDate(tsMillis(p.dueDate)) },
              { header: 'Məbləğ', value: 'amount' },
              { header: 'Ödənilib', value: 'paidAmount' },
              { header: 'Qalıq', value: 'balance' },
              { header: 'Status', value: 'status' },
            ]} />
          </div>
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

        <TabsContent value="exp">
          <div className="mb-3 flex justify-end gap-2">
            <ExportButton filename="xercler" rows={expenses} columns={[
              { header: '№', value: (e) => (e as { expenseNumber?: string }).expenseNumber ?? '' },
              { header: 'Kateqoriya', value: (e) => EXPENSE_CATEGORIES[e.category] ?? e.category },
              { header: 'Təsvir', value: (e) => e.description ?? '' },
              { header: 'Məbləğ', value: 'amount' },
              { header: 'Status', value: (e) => (e as { approvalStatus?: string }).approvalStatus ?? '' },
            ]} />
            {canManage && <Button size="sm" onClick={() => setExpOpen(true)}>+ Xərc</Button>}
          </div>
          <Card className="rounded-card">
            {expenses.length === 0 ? <EmptyState title="Xərc yoxdur" description="Xərc əlavə edin" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>№</TableHead><TableHead>Kateqoriya</TableHead><TableHead>Təsvir</TableHead>
                  <TableHead className="text-right">Məbləğ</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.expenseNumber}</TableCell>
                      <TableCell>{EXPENSE_CATEGORIES[e.category]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.description || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(e.amount, e.currency)}</TableCell>
                      <TableCell><Badge variant={e.approvalStatus === 'paid' ? 'success' : e.approvalStatus === 'approved' ? 'default' : 'secondary'}>{e.approvalStatus}</Badge></TableCell>
                      {canManage && <TableCell>{e.approvalStatus !== 'paid' && <Button size="sm" variant="outline" onClick={() => approveExpense(e)}>{e.approvalStatus === 'submitted' ? 'Təsdiqlə' : 'Ödənildi'}</Button>}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Xərc dialoqu */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yeni xərc</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Kateqoriya</Label>
              <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Məbləğ</Label><Input type="number" step="any" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: +e.target.value })} /></div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Təsvir</Label>
                <AiWriteButton
                  buildPrompt={() => `Cins şalvar istehsalı şirkəti üçün "${EXPENSE_CATEGORIES[exp.category]}" kateqoriyasında ${exp.amount} AZN məbləğində xərc üçün qısa, peşəkar təsvir yaz (Azərbaycan dili, 1 cümlə).`}
                  onResult={(t) => setExp((p) => ({ ...p, description: t }))}
                  disabled={exp.amount <= 0}
                />
              </div>
              <Input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExpOpen(false)}>Ləğv</Button><Button onClick={saveExpense} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Əlavə et</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
