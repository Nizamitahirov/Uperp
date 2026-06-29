'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import type { Payable, PurchaseOrder, Supplier } from '@/types';
import { PO_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: supplier, isLoading } = useQuery({ queryKey: ['suppliers', id], queryFn: () => getDocById<Supplier>('suppliers', id) });
  const { data: orders = [] } = useQuery({ queryKey: ['purchase_orders', 'sup', id], queryFn: () => listDocs<PurchaseOrder>('purchase_orders', [where('supplierId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id });
  const { data: payables = [] } = useQuery({ queryKey: ['payables', 'sup', id], queryFn: () => listDocs<Payable>('payables', [where('supplierId', '==', id)]), enabled: !!id });

  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!supplier) return <div><Button variant="ghost" onClick={() => router.push('/suppliers')}><ArrowLeft className="h-4 w-4" /> Geri</Button><p className="mt-4 text-muted-foreground">Təchizatçı tapılmadı.</p></div>;

  const totalPurchases = orders.reduce((a, o) => a + (o.totalAZN ?? 0), 0);
  const apBalance = payables.reduce((a, p) => a + (p.balance ?? 0), 0);

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/suppliers')}><ArrowLeft className="h-4 w-4" /> Təchizatçılar</Button>
      <PageHeader title={supplier.name} subtitle={`${supplier.code} · ${supplier.country || ''}`} action={<Badge variant={supplier.isActive ? 'success' : 'secondary'}>{supplier.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Ümumi alış" value={formatCurrency(totalPurchases, 'AZN')} />
        <Kpi label="Borc (AP)" value={formatCurrency(apBalance, 'AZN')} />
        <Kpi label="PO sayı" value={String(orders.length)} />
        <Kpi label="Reytinq" value={supplier.rating != null ? `${supplier.rating}/5` : '—'} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="po">Sifarişlər (PO)</TabsTrigger>
          <TabsTrigger value="ap">Borclar (AP)</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="rounded-card"><CardContent className="space-y-2 p-4 text-sm">
            {supplier.contactPerson && <p className="font-medium">{supplier.contactPerson}</p>}
            {supplier.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {supplier.email}</p>}
            {supplier.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {supplier.phone}</p>}
            {supplier.address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {supplier.address}</p>}
            <p className="text-muted-foreground">VÖEN: {supplier.taxNumber || '—'} · Ödəniş: {supplier.paymentTerms || '—'} · Valyuta: {supplier.currency}</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="po">
          <Card className="rounded-card">
            <Table>
              <TableHeader><TableRow><TableHead>PO №</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Məbləğ (AZN)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map((o) => { const m = PO_STATUS_META[o.status] ?? PO_STATUS_META.draft; return (
                  <TableRow key={o.id}><TableCell className="font-mono text-xs"><Link href={`/procurement/${o.id}`} className="hover:underline">{o.poNumber}</Link></TableCell><TableCell>{formatDate(tsMillis(o.orderDate))}</TableCell><TableCell className="text-right">{formatCurrency(o.totalAZN, 'AZN')}</TableCell><TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell></TableRow>
                ); })}
                {orders.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">PO yoxdur</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ap">
          <Card className="rounded-card">
            <Table>
              <TableHeader><TableRow><TableHead>Ödəniş tarixi</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead className="text-right">Qalıq</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {payables.map((p) => <TableRow key={p.id}><TableCell>{formatDate(tsMillis(p.dueDate))}</TableCell><TableCell className="text-right">{formatCurrency(p.amount, 'AZN')}</TableCell><TableCell className="text-right font-medium">{formatCurrency(p.balance, 'AZN')}</TableCell><TableCell><Badge variant={p.status === 'paid' ? 'success' : 'warning'}>{p.status}</Badge></TableCell></TableRow>)}
                {payables.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Borc yoxdur</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></CardContent></Card>;
}
