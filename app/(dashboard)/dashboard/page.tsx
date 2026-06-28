'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, Truck, AlertTriangle, Boxes } from 'lucide-react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import { getRoleName } from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

async function countDocs(path: string, ...constraints: Parameters<typeof query>[1][]) {
  try {
    const c = collection(getDb(), path);
    const snap = await getCountFromServer(constraints.length ? query(c, ...constraints) : c);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export default function DashboardPage() {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const [materials, suppliers, lowStock, finishedGoods] = await Promise.all([
        countDocs('raw_materials', where('isActive', '==', true)),
        countDocs('suppliers', where('isActive', '==', true)),
        countDocs('notifications', where('type', '==', 'low_stock')),
        countDocs('finished_goods'),
      ]);
      return { materials, suppliers, lowStock, finishedGoods };
    },
  });

  const kpis = [
    { label: 'Xam material', value: data?.materials, icon: Package, color: 'text-info' },
    { label: 'Təchizatçı', value: data?.suppliers, icon: Truck, color: 'text-primary' },
    { label: 'Aşağı stok xəbərdarlığı', value: data?.lowStock, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Hazır məhsul (variant)', value: data?.finishedGoods, icon: Boxes, color: 'text-success' },
  ];

  return (
    <div>
      <PageHeader
        title={`İdarə paneli`}
        subtitle={`Xoş gəlmisiniz, ${profile?.fullName ?? ''} · ${getRoleName(profile?.role)}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="rounded-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{kpi.value ?? 0}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 rounded-card">
        <CardHeader>
          <CardTitle>Sistem haqqında</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Bu, cins şalvar istehsalı üçün ERP/MES sisteminin Faza 1 (Təməl) versiyasıdır: autentifikasiya,
            RBAC, dizayn sistemi, xam material və təchizatçı modulları. Növbəti fazalarda stok hərəkətləri
            (FIFO/AVCO), PO/GRN, istehsal, yuyulma və satış modulları əlavə olunacaq.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
