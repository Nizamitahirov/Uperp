'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Check, Plus, X } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { acceptQuotation, rejectQuotation } from '@/lib/firebase/quotations';
import { useAuth } from '@/components/providers/auth-provider';
import type { Quotation } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' }> = {
  sent: { label: 'Göndərilib', variant: 'default' },
  accepted: { label: 'Qəbul edilib', variant: 'success' },
  rejected: { label: 'Rədd edilib', variant: 'destructive' },
  expired: { label: 'Vaxtı keçib', variant: 'secondary' },
};

export default function QuotationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { profile, can } = useAuth();
  const [working, setWorking] = useState('');
  const canManage = can('sales_orders', 'create');

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => listDocs<Quotation>('quotations', [orderBy('createdAt', 'desc')]),
  });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  async function accept(q: Quotation) {
    setWorking(q.id);
    try {
      const orderId = await acceptQuotation(q, actor);
      toast.success('Təklif sifarişə çevrildi');
      qc.invalidateQueries({ queryKey: ['quotations'] });
      router.push(`/sales/${orderId}`);
    } catch { toast.error('Alınmadı'); } finally { setWorking(''); }
  }
  async function reject(q: Quotation) {
    setWorking(q.id);
    try { await rejectQuotation(q.id, actor); toast.success('Rədd edildi'); qc.invalidateQueries({ queryKey: ['quotations'] }); }
    catch { toast.error('Alınmadı'); } finally { setWorking(''); }
  }

  return (
    <div>
      <PageHeader title="Qiymət Təklifləri" subtitle="Quotation → satış sifarişi" action={
        <div className="flex gap-2">
          <ExportButton filename="teklifler" rows={quotes} columns={[
            { header: 'Nömrə', value: 'quoteNumber' },
            { header: 'Müştəri', value: (q) => q.customerName ?? '' },
            { header: 'Məbləğ', value: 'totalAmount' },
            { header: 'Status', value: 'status' },
          ]} />
          {canManage && <Button asChild><Link href="/sales/new"><Plus /> Yeni təklif</Link></Button>}
        </div>
      } />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : quotes.length === 0 ? (
          <EmptyState title="Təklif yoxdur" description="Satış formundan 'Təklif kimi saxla' ilə yaradın" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QT №</TableHead><TableHead>Müştəri</TableHead><TableHead>Etibarlıdır</TableHead>
                <TableHead className="text-right">Yekun</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const m = STATUS[q.status] ?? STATUS.sent;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quoteNumber}</TableCell>
                    <TableCell className="font-medium">{q.customerName}</TableCell>
                    <TableCell>{formatDate(tsMillis(q.validUntil))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(q.totalAmount, 'AZN')}</TableCell>
                    <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {q.status === 'sent' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={() => accept(q)} disabled={working === q.id}><Check className="h-4 w-4" /> Qəbul</Button>
                            <Button size="sm" variant="outline" className="text-danger" onClick={() => reject(q)} disabled={working === q.id}><X className="h-4 w-4" /></Button>
                          </div>
                        )}
                        {q.status === 'accepted' && q.convertedOrderId && <Link href={`/sales/${q.convertedOrderId}`} className="text-sm text-primary hover:underline">Sifarişə bax</Link>}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
