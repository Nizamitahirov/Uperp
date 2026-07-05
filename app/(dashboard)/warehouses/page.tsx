'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Warehouse as WarehouseIcon, Plus, Pencil, Trash2, ArrowLeftRight, Loader2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createWarehouse, updateWarehouse, deleteWarehouse, createTransfer } from '@/lib/firebase/warehouses';
import { useAuth } from '@/components/providers/auth-provider';
import type { RawMaterial, StockTransfer, Warehouse } from '@/types';
import { formatNumber, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

const TYPE_LABELS: Record<string, string> = { raw: 'Xam material', finished: 'Hazır məhsul', general: 'Ümumi' };

export default function WarehousesPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('raw_materials', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [whOpen, setWhOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'general' as Warehouse['type'], address: '', isActive: true });
  const [delTarget, setDelTarget] = useState<Warehouse | null>(null);
  const [saving, setSaving] = useState(false);

  const [trOpen, setTrOpen] = useState(false);
  const [tr, setTr] = useState({ fromWarehouseId: '', toWarehouseId: '', materialId: '', quantity: 0, note: '' });

  const { data: warehouses = [], isLoading } = useQuery({ queryKey: ['warehouses'], queryFn: () => listDocs<Warehouse>('warehouses', [orderBy('createdAt', 'desc')]) });
  const { data: transfers = [] } = useQuery({ queryKey: ['stock_transfers'], queryFn: () => listDocs<StockTransfer>('stock_transfers', [orderBy('createdAt', 'desc')]) });
  const { data: materials = [] } = useQuery({ queryKey: ['raw_materials'], queryFn: () => listDocs<RawMaterial>('raw_materials') });

  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();
  const activeWh = useMemo(() => warehouses.filter((w) => w.isActive), [warehouses]);

  function openWh(w?: Warehouse) {
    if (w) { setEditing(w); setForm({ code: w.code, name: w.name, type: w.type, address: w.address ?? '', isActive: w.isActive }); }
    else { setEditing(null); setForm({ code: '', name: '', type: 'general', address: '', isActive: true }); }
    setWhOpen(true);
  }

  async function saveWh() {
    if (!form.name.trim()) { toast.error('Ad daxil edin'); return; }
    setSaving(true);
    try {
      if (editing) await updateWarehouse(editing.id, form, actor);
      else await createWarehouse({ ...form, code: form.code || form.name.slice(0, 3).toUpperCase() }, actor);
      toast.success(editing ? 'Anbar yeniləndi' : 'Anbar yaradıldı');
      setWhOpen(false); qc.invalidateQueries({ queryKey: ['warehouses'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  async function delWh() {
    if (!delTarget) return;
    setSaving(true);
    try { await deleteWarehouse(delTarget.id, actor); toast.success('Silindi'); setDelTarget(null); qc.invalidateQueries({ queryKey: ['warehouses'] }); }
    catch { toast.error('Silinmədi'); } finally { setSaving(false); }
  }

  async function saveTransfer() {
    if (!tr.fromWarehouseId || !tr.toWarehouseId || !tr.materialId || tr.quantity <= 0) { toast.error('Bütün sahələri doldurun'); return; }
    setSaving(true);
    try {
      const from = warehouses.find((w) => w.id === tr.fromWarehouseId);
      const to = warehouses.find((w) => w.id === tr.toWarehouseId);
      await createTransfer({ ...tr, fromWarehouseName: from?.name, toWarehouseName: to?.name }, actor);
      toast.success('Transfer qeydə alındı');
      setTrOpen(false); setTr({ fromWarehouseId: '', toWarehouseId: '', materialId: '', quantity: 0, note: '' });
      qc.invalidateQueries({ queryKey: ['stock_transfers'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Anbarlar" subtitle="Çox-anbar idarəetməsi və anbarlararası transfer" />

      <Tabs defaultValue="warehouses">
        <TabsList>
          <TabsTrigger value="warehouses"><WarehouseIcon className="mr-1.5 h-4 w-4" /> Anbarlar</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transferlər</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses">
          {canManage && <div className="mb-3 flex justify-end"><Button onClick={() => openWh()}><Plus /> Yeni anbar</Button></div>}
          <Card className="rounded-card">
            {isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : warehouses.length === 0 ? (
              <EmptyState title="Anbar yoxdur" description="İlk anbarı əlavə edin" action={canManage ? <Button onClick={() => openWh()}><Plus /> Yeni anbar</Button> : undefined} />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Növ</TableHead><TableHead>Ünvan</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.code}</TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{TYPE_LABELS[w.type] ?? w.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.address || '—'}</TableCell>
                      <TableCell><Badge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? 'Aktiv' : 'Deaktiv'}</Badge></TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openWh(w)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-danger" onClick={() => setDelTarget(w)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <div className="mb-3 flex justify-end gap-2">
            <ExportButton filename="transferler" rows={transfers} columns={[
              { header: '№', value: 'number' },
              { header: 'Material', value: (t) => t.materialName ?? '' },
              { header: 'Mənbə', value: (t) => t.fromWarehouseName ?? '' },
              { header: 'Hədəf', value: (t) => t.toWarehouseName ?? '' },
              { header: 'Miqdar', value: 'quantity' },
            ]} />
            {canManage && <Button onClick={() => setTrOpen(true)} disabled={activeWh.length < 2}><ArrowLeftRight className="h-4 w-4" /> Yeni transfer</Button>}
          </div>
          <Card className="rounded-card">
            {transfers.length === 0 ? (
              <EmptyState title="Transfer yoxdur" description={activeWh.length < 2 ? 'Ən azı 2 aktiv anbar lazımdır' : 'İlk transferi yaradın'} />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>№</TableHead><TableHead>Tarix</TableHead><TableHead>Material</TableHead><TableHead>Mənbə</TableHead><TableHead>Hədəf</TableHead><TableHead className="text-right">Miqdar</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.number}</TableCell>
                      <TableCell>{formatDate(ms(t.createdAt))}</TableCell>
                      <TableCell className="font-medium">{t.materialName}</TableCell>
                      <TableCell>{t.fromWarehouseName}</TableCell>
                      <TableCell className="text-primary">{t.toWarehouseName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(t.quantity)} {t.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">Transfer fiziki yerdəyişməni sənədləşdirir və stok hərəkəti (TRF_WAREHOUSE) yazır. Ümumi stok qalığı dəyişmir.</p>
        </TabsContent>
      </Tabs>

      {/* Anbar dialoqu */}
      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Anbarı düzəlt' : 'Yeni anbar'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Kod</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MAIN" /></div>
              <div className="space-y-1.5"><Label>Növ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Warehouse['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Ad *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Əsas anbar" /></div>
            <div className="space-y-1.5"><Label>Ünvan</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktiv</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setWhOpen(false)}>Ləğv</Button><Button onClick={saveWh} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialoqu */}
      <Dialog open={trOpen} onOpenChange={setTrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anbarlararası transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Material *</Label>
              <Select value={tr.materialId} onValueChange={(v) => setTr({ ...tr, materialId: v })}>
                <SelectTrigger><SelectValue placeholder="Material seç" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({formatNumber(m.currentStock ?? 0)} {m.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Mənbə anbar *</Label>
                <Select value={tr.fromWarehouseId} onValueChange={(v) => setTr({ ...tr, fromWarehouseId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                  <SelectContent>{activeWh.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Hədəf anbar *</Label>
                <Select value={tr.toWarehouseId} onValueChange={(v) => setTr({ ...tr, toWarehouseId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                  <SelectContent>{activeWh.filter((w) => w.id !== tr.fromWarehouseId).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Miqdar *</Label><Input type="number" step="any" value={tr.quantity} onChange={(e) => setTr({ ...tr, quantity: +e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Qeyd</Label><Input value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTrOpen(false)}>Ləğv</Button><Button onClick={saveTransfer} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Transfer et</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)} title="Anbarı sil" description={`"${delTarget?.name}" silinsin?`} onConfirm={delWh} loading={saving} />
    </div>
  );
}
