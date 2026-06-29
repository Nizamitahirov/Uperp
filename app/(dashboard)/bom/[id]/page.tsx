'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getDocById } from '@/lib/firebase/firestore';
import type { BOM } from '@/types';
import { BOM_STATUS_META } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: bom, isLoading } = useQuery({
    queryKey: ['boms', id],
    queryFn: () => getDocById<BOM>('boms', id),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!bom) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/bom')}><ArrowLeft className="h-4 w-4" /> Geri</Button>
        <p className="mt-4 text-muted-foreground">BOM tapılmadı.</p>
      </div>
    );
  }

  const sizes = Object.keys(bom.sizeBasedItems ?? {});
  const meta = BOM_STATUS_META[bom.status] ?? BOM_STATUS_META.draft;
  // Material sətirlərini ölçü sütunları ilə birləşdir
  const firstSize = sizes[0];
  const materialRows = firstSize ? bom.sizeBasedItems[firstSize] : [];

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/bom')}><ArrowLeft className="h-4 w-4" /> BOM siyahısı</Button>
      <PageHeader title={bom.bomNumber} subtitle={`${bom.productName} · v${bom.version}`} action={<Badge variant={meta.variant}>{meta.label}</Badge>} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Material maya (orta)" value={formatCurrency(bom.materialCost, 'AZN')} />
        <Kpi label="Əmək" value={formatCurrency(bom.laborCost, 'AZN')} />
        <Kpi label="Overhead" value={`${bom.overheadPercentage}%`} />
        <Kpi label="Standard cost" value={formatCurrency(bom.totalCost, 'AZN')} />
      </div>

      <Card className="rounded-card">
        <CardHeader><CardTitle className="text-base">Materiallar (ölçü × miqdar)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-20">Fire %</TableHead>
                {sizes.map((s) => <TableHead key={s} className="text-center">{s}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialRows.map((row, idx) => (
                <TableRow key={row.materialId}>
                  <TableCell>
                    <p className="font-medium">{row.materialName}</p>
                    <p className="text-xs text-muted-foreground">{row.materialCode} · {row.unit}</p>
                  </TableCell>
                  <TableCell>{row.wastagePercentage}%</TableCell>
                  {sizes.map((s) => (
                    <TableCell key={s} className="text-center">{bom.sizeBasedItems[s]?.[idx]?.quantity ?? 0}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
