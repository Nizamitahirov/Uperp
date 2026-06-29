'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { ArrowLeft, Check, FileUp, Plus, X } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { updatePRStatus, convertPRtoPO } from '@/lib/firebase/procurement';
import { useAuth } from '@/components/providers/auth-provider';
import type { PurchaseRequest } from '@/types';
import { PR_STATUS_META, PR_REASONS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function PRListPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { profile, can } = useAuth();
  const [busy, setBusy] = useState('');

  const canCreate = can('purchase_orders', 'create');
  const canApprove = can('purchase_orders', 'approve');
  const { data: prs = [], isLoading } = useQuery({
    queryKey: ['purchase_requests'],
    queryFn: () => listDocs<PurchaseRequest>('purchase_requests', [orderBy('createdAt', 'desc')]),
  });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  async function act(fn: () => Promise<void>, id: string, msg: string) {
    setBusy(id);
    try { await fn(); toast.success(msg); qc.invalidateQueries({ queryKey: ['purchase_requests'] }); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setBusy(''); }
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" asChild><Link href="/procurement"><ArrowLeft className="h-4 w-4" /> Satınalma</Link></Button>
      <PageHeader title="Alış Tələbləri (PR)" subtitle="PR → təsdiq → PO" action={canCreate && <Button asChild><Link href="/procurement/pr/new"><Plus /> Yeni PR</Link></Button>} />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : prs.length === 0 ? (
          <EmptyState title="PR yoxdur" description="Yeni alış tələbi yaradın" action={canCreate ? <Button asChild><Link href="/procurement/pr/new"><Plus /> Yeni PR</Link></Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR №</TableHead><TableHead>Səbəb</TableHead><TableHead>Prioritet</TableHead><TableHead>Tarix</TableHead>
                <TableHead className="text-right">Təxmini</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Əməliyyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prs.map((pr) => {
                const meta = PR_STATUS_META[pr.status] ?? PR_STATUS_META.draft;
                return (
                  <TableRow key={pr.id}>
                    <TableCell className="font-mono text-xs">{pr.prNumber}</TableCell>
                    <TableCell>{PR_REASONS[pr.reason] ?? pr.reason}</TableCell>
                    <TableCell>{pr.priority}</TableCell>
                    <TableCell>{formatDate(tsMillis(pr.requestedDate) ?? tsMillis(pr.createdAt))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pr.totalEstimated, 'AZN')}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {pr.status === 'draft' && canCreate && (
                          <Button size="sm" variant="outline" disabled={busy === pr.id} onClick={() => act(() => updatePRStatus(pr.id, 'pending_approval', actor), pr.id, 'Təsdiqə göndərildi')}>Göndər</Button>
                        )}
                        {pr.status === 'pending_approval' && canApprove && (
                          <>
                            <Button size="sm" disabled={busy === pr.id} onClick={() => act(() => updatePRStatus(pr.id, 'approved', actor), pr.id, 'Təsdiqləndi')}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" className="text-danger" disabled={busy === pr.id} onClick={() => act(() => updatePRStatus(pr.id, 'rejected', actor), pr.id, 'Rədd edildi')}><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {pr.status === 'approved' && canCreate && (
                          <Button size="sm" disabled={busy === pr.id} onClick={() => act(async () => { const poId = await convertPRtoPO(pr, pr.suggestedSupplierName ?? '', actor); router.push(`/procurement/${poId}`); }, pr.id, 'PO yaradıldı')}><FileUp className="h-4 w-4" /> PO-ya çevir</Button>
                        )}
                        {pr.status === 'converted_to_po' && pr.convertedPoId && (
                          <Link href={`/procurement/${pr.convertedPoId}`} className="text-sm text-primary hover:underline">PO-ya bax</Link>
                        )}
                      </div>
                    </TableCell>
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
