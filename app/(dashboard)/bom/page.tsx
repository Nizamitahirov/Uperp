'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { BOM } from '@/types';
import { BOM_STATUS_META } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BOMListPage() {
  const { can } = useAuth();
  const canCreate = can('bom', 'create');
  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: () => listDocs<BOM>('boms', [orderBy('createdAt', 'desc')]),
  });

  return (
    <div>
      <PageHeader
        title="BOM — Material Reçetləri"
        subtitle="Ölçüyə görə material reçeti və maya dəyəri"
        action={
          <div className="flex gap-2">
            <ExportButton filename="bom-recetler" rows={boms} columns={[
              { header: 'BOM №', value: 'bomNumber' },
              { header: 'Məhsul', value: (b) => b.productName ?? '' },
              { header: 'Versiya', value: 'version' },
              { header: 'Əmək (dəq)', value: 'laborMinutes' },
              { header: 'Əmək maya', value: 'laborCost' },
              { header: 'Ümumi maya', value: 'totalCost' },
              { header: 'Status', value: 'status' },
            ]} />
            {canCreate && <Button asChild><Link href="/bom/new"><Plus /> Yeni BOM</Link></Button>}
          </div>
        }
      />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : boms.length === 0 ? (
          <EmptyState title="BOM tapılmadı" description="Hələ reçet yoxdur" action={canCreate ? <Button asChild><Link href="/bom/new"><Plus /> Yeni BOM</Link></Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM №</TableHead>
                <TableHead>Məhsul</TableHead>
                <TableHead>Versiya</TableHead>
                <TableHead className="text-right">Material maya</TableHead>
                <TableHead className="text-right">Standard cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.map((b) => {
                const meta = BOM_STATUS_META[b.status] ?? BOM_STATUS_META.draft;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/bom/${b.id}`} className="hover:underline">{b.bomNumber}</Link>
                    </TableCell>
                    <TableCell className="font-medium">{b.productName}</TableCell>
                    <TableCell>v{b.version}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.materialCost, 'AZN')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(b.totalCost, 'AZN')}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
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
