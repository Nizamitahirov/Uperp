'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { KeyRound, Pencil, Plus, Search, ShieldAlert, UserX } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createUserAccount, updateUserProfile, deactivateUser, sendUserPasswordReset } from '@/lib/firebase/users';
import { useAuth } from '@/components/providers/auth-provider';
import { ROLES, getRoleName } from '@/lib/rbac/permissions';
import type { AppUser } from '@/types';
import type { UserFormValues, UserEditFormValues } from '@/lib/validations';
import { formatDateTime } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { UserFormDialog } from './user-form-dialog';

const COLLECTION = 'users';

export default function UsersPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
  const [working, setWorking] = useState(false);

  const canCreate = can('users', 'create');
  const canUpdate = can('users', 'update');
  const canDelete = can('users', 'delete');

  const { data: users = [], isLoading } = useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<AppUser>(COLLECTION, [orderBy('createdAt', 'desc')]),
  });

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    return { total, active, inactive: total - active };
  }, [users]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(s) ||
        u.fullName?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s),
    );
  }, [users, search]);

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  async function handleCreate(values: UserFormValues) {
    setSubmitting(true);
    try {
      await createUserAccount(values, actor);
      toast.success('İstifadəçi yaradıldı');
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      toast.error(
        'İstifadəçi yaradılmadı',
        code === 'auth/email-already-in-use' ? 'Bu email artıq istifadədədir' : code,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: UserEditFormValues) {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateUserProfile(
        editing.uid,
        {
          fullName: values.fullName,
          phone: values.phone || undefined,
          role: values.role as AppUser['role'],
          isActive: values.isActive,
          status: values.isActive ? 'active' : 'inactive',
        },
        actor,
      );
      toast.success('İstifadəçi yeniləndi');
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch {
      toast.error('Yenilənmə alınmadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setWorking(true);
    try {
      await deactivateUser(deactivateTarget.uid, actor);
      toast.success('İstifadəçi deaktiv edildi');
      setDeactivateTarget(null);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch {
      toast.error('Əməliyyat alınmadı');
    } finally {
      setWorking(false);
    }
  }

  async function handleResetPassword(u: AppUser) {
    try {
      await sendUserPasswordReset(u.email);
      toast.success('Parol sıfırlama emaili göndərildi', u.email);
    } catch {
      toast.error('Email göndərilmədi');
    }
  }

  return (
    <div>
      <PageHeader
        title="İstifadəçi İdarəetməsi"
        subtitle="Daxili işçilər, rollar və status"
        action={
          canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus /> Yeni istifadəçi
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatCard label="Ümumi" value={stats.total} />
        <StatCard label="Aktiv" value={stats.active} className="text-success" />
        <StatCard label="Deaktiv" value={stats.inactive} className="text-muted-foreground" />
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Ad, istifadəçi adı və ya email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="İstifadəçi tapılmadı"
            description={search ? 'Axtarışa uyğun nəticə yoxdur' : 'Hələ istifadəçi yoxdur'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İstifadəçi</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Son giriş</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Əməliyyat</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                        <AvatarFallback>{(u.fullName || u.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">{u.fullName || u.username}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'director' ? 'default' : 'secondary'}>{getRoleName(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLogin ? formatDateTime((u.lastLogin as { toMillis?: () => number })?.toMillis?.()) : '—'}
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setFormOpen(true); }} aria-label="Düzəlt">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => handleResetPassword(u)} aria-label="Parol sıfırla">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && u.isActive && u.uid !== profile?.uid && (
                          <Button variant="ghost" size="icon" className="text-danger" onClick={() => setDeactivateTarget(u)} aria-label="Deaktiv et">
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 rounded-card border border-dashed p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          İstifadəçi yaratma cari admin sessiyasını saxlayaraq ikinci Firebase instansı ilə həyata keçirilir.
          Tam Admin SDK (Cloud Functions) inteqrasiyası sonrakı fazada əlavə oluna bilər. {ROLES.director.name}
          {' '}rolu bütün modullara çıxış verir.
        </p>
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="İstifadəçini deaktiv et"
        description={`"${deactivateTarget?.fullName || deactivateTarget?.username}" deaktiv edilsin? Giriş bloklanacaq (soft-delete).`}
        confirmLabel="Deaktiv et"
        onConfirm={handleDeactivate}
        loading={working}
      />
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="rounded-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${className ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
