'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { limit, orderBy } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ACTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'STOCK_MOVE'] as const;

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  CREATE: 'success', UPDATE: 'default', DELETE: 'destructive', LOGIN: 'secondary', LOGOUT: 'secondary', APPROVE: 'warning', STOCK_MOVE: 'default',
};

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string>('ALL');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: () => listDocs<AuditLog>('audit_logs', [orderBy('timestamp', 'desc'), limit(300)]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return logs.filter((l) =>
      (action === 'ALL' || l.action === action) &&
      (!s || l.username?.toLowerCase().includes(s) || l.entityType?.toLowerCase().includes(s) || l.entityId?.toLowerCase().includes(s)),
    );
  }, [logs, search, action]);

  function tsMillis(t: unknown) { return (t as { toMillis?: () => number })?.toMillis?.(); }

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Sistem əməliyyatları tarixçəsi (kim, nə, nə vaxt)" />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="İstifadəçi, entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === 'ALL' ? 'Bütün əməliyyatlar' : a}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Qeyd yoxdur" description="Audit qeydləri əməliyyatlardan sonra görünəcək" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vaxt</TableHead>
                <TableHead>İstifadəçi</TableHead>
                <TableHead>Əməliyyat</TableHead>
                <TableHead>Obyekt</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{formatDateTime(tsMillis(l.timestamp))}</TableCell>
                  <TableCell>{l.username || '—'}</TableCell>
                  <TableCell><Badge variant={ACTION_VARIANT[l.action] ?? 'secondary'}>{l.action}</Badge></TableCell>
                  <TableCell>{l.entityType}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.entityId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
