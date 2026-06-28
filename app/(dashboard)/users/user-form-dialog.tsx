'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  userSchema,
  userEditSchema,
  type UserFormValues,
  type UserEditFormValues,
} from '@/lib/validations';
import { ROLES, ALL_ROLE_CODES, type RoleCode } from '@/lib/rbac/permissions';
import type { AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Daxili işçi rolları (customer self-register edir, burada təyin olunmur)
const STAFF_ROLES = ALL_ROLE_CODES.filter((r) => r !== 'customer');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AppUser | null;
  onCreate: (values: UserFormValues) => Promise<void>;
  onUpdate: (values: UserEditFormValues) => Promise<void>;
  submitting: boolean;
}

const CREATE_DEFAULTS: UserFormValues = {
  fullName: '',
  email: '',
  username: '',
  phone: '',
  role: 'warehouse',
  password: '',
  isActive: true,
};

export function UserFormDialog({ open, onOpenChange, initial, onCreate, onUpdate, submitting }: Props) {
  const isEdit = !!initial;

  const createForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: CREATE_DEFAULTS,
  });
  const editForm = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: { fullName: '', phone: '', role: 'warehouse', isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      editForm.reset({
        fullName: initial.fullName,
        phone: initial.phone ?? '',
        role: initial.role,
        isActive: initial.isActive,
      });
    } else {
      createForm.reset(CREATE_DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const role = isEdit ? editForm.watch('role') : createForm.watch('role');
  const isActive = isEdit ? editForm.watch('isActive') : createForm.watch('isActive');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'İstifadəçini düzəlt' : 'Yeni istifadəçi'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Ad, telefon, rol və statusu dəyişə bilərsiniz' : 'Yeni daxili işçi hesabı yaradın'}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={editForm.handleSubmit(onUpdate)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="İstifadəçi adı">
              <Input value={initial?.username ?? ''} disabled />
            </Field>
            <Field label="Email">
              <Input value={initial?.email ?? ''} disabled />
            </Field>
            <Field label="Tam ad *" error={editForm.formState.errors.fullName?.message}>
              <Input {...editForm.register('fullName')} />
            </Field>
            <Field label="Telefon" error={editForm.formState.errors.phone?.message}>
              <Input {...editForm.register('phone')} placeholder="+994XXXXXXXXX" />
            </Field>
            <Field label="Rol *" error={editForm.formState.errors.role?.message}>
              <RoleSelect value={role} onChange={(v) => editForm.setValue('role', v)} />
            </Field>
            <Field label="Status">
              <StatusSelect value={isActive} onChange={(v) => editForm.setValue('isActive', v)} />
            </Field>
            <Footer onCancel={() => onOpenChange(false)} submitting={submitting} />
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreate)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tam ad *" error={createForm.formState.errors.fullName?.message}>
              <Input {...createForm.register('fullName')} />
            </Field>
            <Field label="İstifadəçi adı *" error={createForm.formState.errors.username?.message}>
              <Input {...createForm.register('username')} placeholder="anbardar_01" />
            </Field>
            <Field label="Email *" error={createForm.formState.errors.email?.message}>
              <Input type="email" {...createForm.register('email')} />
            </Field>
            <Field label="Telefon" error={createForm.formState.errors.phone?.message}>
              <Input {...createForm.register('phone')} placeholder="+994XXXXXXXXX" />
            </Field>
            <Field label="Rol *" error={createForm.formState.errors.role?.message}>
              <RoleSelect value={role} onChange={(v) => createForm.setValue('role', v)} />
            </Field>
            <Field label="Status">
              <StatusSelect value={isActive} onChange={(v) => createForm.setValue('isActive', v)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Parol *" error={createForm.formState.errors.password?.message}>
                <Input type="password" {...createForm.register('password')} />
                <p className="text-xs text-muted-foreground">Min. 8 simvol, böyük/kiçik hərf, rəqəm və simvol</p>
              </Field>
            </div>
            <Footer onCancel={() => onOpenChange(false)} submitting={submitting} />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: RoleCode) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RoleCode)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAFF_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLES[r].name} (səviyyə {ROLES[r].level})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusSelect({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Select value={value ? 'active' : 'inactive'} onValueChange={(v) => onChange(v === 'active')}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Aktiv</SelectItem>
        <SelectItem value="inactive">Deaktiv</SelectItem>
      </SelectContent>
    </Select>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function Footer({ onCancel, submitting }: { onCancel: () => void; submitting: boolean }) {
  return (
    <DialogFooter className="sm:col-span-2 mt-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        Ləğv et
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" />}
        Yadda saxla
      </Button>
    </DialogFooter>
  );
}
