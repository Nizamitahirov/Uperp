'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import type { Customer, Deal, Receivable, SalesOrder } from '@/types';
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES, SALES_ORDER_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: customer, isLoading } = useQuery({ queryKey: ['customers', id], queryFn: () => getDocById<Customer>('customers', id) });
  const { data: orders = [] } = useQuery({ queryKey: ['sales_orders', 'cust', id], queryFn: () => listDocs<SalesOrder>('sales_orders', [where('customerId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id });
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables', 'cust', id], queryFn: () => listDocs<Receivable>('receivables', [where('customerId', '==', id)]), enabled: !!id });
  const { data: deals = [] } = useQuery({ queryKey: ['deals', 'cust', id], queryFn: () => listDocs<Deal>('deals', [where('customerId', '==', id)]), enabled: !!id });

  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!customer) return <div><Button variant="ghost" onClick={() => router.push('/customers')}><ArrowLeft className="h-4 w-4" /> Geri</Button><p className="mt-4 text-muted-foreground">Müştəri tapılmadı.</p></div>;

  const seg = CUSTOMER_SEGMENTS[customer.segment] ?? CUSTOMER_SEGMENTS.regular;
  const totalSales = orders.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.totalAmount, 0);
  const arBalance = receivables.reduce((a, r) => a + (r.balance ?? 0), 0);

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/customers')}><ArrowLeft className="h-4 w-4" /> Müştərilər</Button>
      <PageHeader title={customer.name} subtitle={`${customer.code} · ${CUSTOMER_TYPES[customer.type]}`} action={<Badge variant={seg.variant}>{seg.label}</Badge>} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Ümumi satış" value={formatCurrency(totalSales, 'AZN')} />
        <Kpi label="Cari balans (AR)" value={formatCurrency(arBalance, 'AZN')} />
        <Kpi label="Kredit limiti" value={formatCurrency(customer.creditLimit, 'AZN')} />
        <Kpi label="Sifariş sayı" value={String(orders.length)} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="orders">Sifarişlər</TabsTrigger>
          <TabsTrigger value="ar">Ödənişlər (AR)</TabsTrigger>
          <TabsTrigger value="deals">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="rounded-card"><CardContent className="space-y-2 p-4 text-sm">
            {customer.companyName && <p className="font-medium">{customer.companyName}</p>}
            {customer.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {customer.email}</p>}
            {customer.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {customer.phone}</p>}
            {customer.address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {customer.address}</p>}
            <p className="text-muted-foreground">VÖEN: {customer.taxNumber || '—'} · Endirim: {customer.discountRate}% · Ödəniş: {customer.paymentTermDays} gün</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="rounded-card">
            <Table>
              <TableHeader><TableRow><TableHead>SO №</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map((o) => { const m = SALES_ORDER_STATUS_META[o.status] ?? SALES_ORDER_STATUS_META.new; return (
                  <TableRow key={o.id}><TableCell className="font-mono text-xs"><Link href={`/sales/${o.id}`} className="hover:underline">{o.soNumber}</Link></TableCell><TableCell>{formatDate(tsMillis(o.date))}</TableCell><TableCell className="text-right">{formatCurrency(o.totalAmount, 'AZN')}</TableCell><TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell></TableRow>
                ); })}
                {orders.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Sifariş yoxdur</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ar">
          <Card className="rounded-card">
            <Table>
              <TableHeader><TableRow><TableHead>Faktura</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead className="text-right">Qalıq</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {receivables.map((r) => <TableRow key={r.id}><TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell><TableCell className="text-right">{formatCurrency(r.amount, 'AZN')}</TableCell><TableCell className="text-right font-medium">{formatCurrency(r.balance, 'AZN')}</TableCell><TableCell><Badge variant={r.status === 'paid' ? 'success' : 'warning'}>{r.status}</Badge></TableCell></TableRow>)}
                {receivables.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Borc yoxdur</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="deals">
          <Card className="rounded-card">
            <Table>
              <TableHeader><TableRow><TableHead>Başlıq</TableHead><TableHead>Mərhələ</TableHead><TableHead className="text-right">Dəyər</TableHead></TableRow></TableHeader>
              <TableBody>
                {deals.map((d) => <TableRow key={d.id}><TableCell className="font-medium">{d.title}</TableCell><TableCell><Badge variant="secondary">{d.stage}</Badge></TableCell><TableCell className="text-right">{formatCurrency(d.estimatedValue, 'AZN')}</TableCell></TableRow>)}
                {deals.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Deal yoxdur</TableCell></TableRow>}
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
