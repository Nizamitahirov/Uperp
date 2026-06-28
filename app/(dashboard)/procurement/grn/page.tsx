'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import type { GRN } from '@/types';
import { formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function GRNListPage() {
  const { data: grns = [], isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: () => listDocs<GRN>('grns', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" asChild>
        <Link href="/procurement">
          <ArrowLeft className="h-4 w-4" /> Satınalma
        </Link>
      </Button>
      <PageHeader title="Mədaxil Qaimələri (GRN)" subtitle="Qəbul edilmiş materiallar" />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : grns.length === 0 ? (
          <EmptyState title="GRN tapılmadı" description="Hələ material qəbulu yoxdur" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN №</TableHead>
                <TableHead>PO №</TableHead>
                <TableHead>Təchizatçı</TableHead>
                <TableHead>Tarix</TableHead>
                <TableHead>Sətirlər</TableHead>
                <TableHead>Keyfiyyət</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grns.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs">{g.grnNumber}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/procurement/${g.purchaseOrderId}`} className="hover:underline">
                      {g.poNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{g.supplierName || '—'}</TableCell>
                  <TableCell>{formatDate(tsMillis(g.createdAt))}</TableCell>
                  <TableCell>{g.items?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={g.qualityStatus === 'approved' ? 'success' : 'warning'}>
                      {g.qualityStatus === 'approved' ? 'Tam' : g.qualityStatus === 'partial' ? 'Qismən' : 'Rədd'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
