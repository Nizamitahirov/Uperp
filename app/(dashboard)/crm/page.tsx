'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { Loader2, Plus } from 'lucide-react';
import { listDocs, createDoc, updateDocById } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { Customer, Deal, DealStage } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

const STAGES: { key: DealStage; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'contacted', label: 'Əlaqə' },
  { key: 'quotation', label: 'Təklif' },
  { key: 'negotiation', label: 'Danışıq' },
  { key: 'won', label: 'Uğurlu' },
  { key: 'lost', label: 'İtirilmiş' },
];

export default function CRMPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ customerId: '', title: '', estimatedValue: 0, probability: 50, stage: 'lead' as DealStage });

  const canCreate = can('customers', 'create');
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => listDocs<Deal>('deals', [orderBy('createdAt', 'desc')]) });
  const { data: customers = [] } = useQuery({ queryKey: ['customers', 'active'], queryFn: () => listDocs<Customer>('customers', [where('status', '==', 'active')]) });

  async function moveStage(deal: Deal, stage: DealStage) {
    await updateDocById('deals', deal.id, { stage });
    qc.invalidateQueries({ queryKey: ['deals'] });
  }

  async function save() {
    if (!form.customerId || !form.title) {
      toast.error('Müştəri və başlıq tələb olunur');
      return;
    }
    setSubmitting(true);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      await createDoc('deals', {
        customerId: form.customerId,
        customerName: customer?.name ?? '',
        title: form.title,
        stage: form.stage,
        estimatedValue: Number(form.estimatedValue),
        probability: Number(form.probability),
        assignedTo: profile?.uid ?? '',
      });
      toast.success('Deal yaradıldı');
      setOpen(false);
      setForm({ customerId: '', title: '', estimatedValue: 0, probability: 50, stage: 'lead' });
      qc.invalidateQueries({ queryKey: ['deals'] });
    } catch {
      toast.error('Yaradılmadı');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="CRM — Satış Pipeline"
        subtitle="Deal-lar mərhələ üzrə (Kanban)"
        action={canCreate && <Button onClick={() => setOpen(true)}><Plus /> Yeni deal</Button>}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const items = deals.filter((d) => d.stage === stage.key);
          const total = items.reduce((s, d) => s + (d.estimatedValue || 0), 0);
          return (
            <div key={stage.key} className="rounded-card bg-muted/40 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{stage.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <p className="mb-2 px-1 text-xs text-muted-foreground">{formatCurrency(total, 'AZN')}</p>
              <div className="space-y-2">
                {items.map((d) => (
                  <Card key={d.id} className="rounded-card">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium leading-tight">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.customerName}</p>
                      <p className="mt-1 text-xs font-medium">{formatCurrency(d.estimatedValue, 'AZN')} · {d.probability}%</p>
                      <Select value={d.stage} onValueChange={(v) => moveStage(d, v as DealStage)}>
                        <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni deal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Müştəri</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Başlıq</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Dəyər (AZN)</Label><Input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: +e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Ehtimal %</Label><Input type="number" value={form.probability} onChange={(e) => setForm({ ...form, probability: +e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Ləğv et</Button>
            <Button onClick={save} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Yarat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
