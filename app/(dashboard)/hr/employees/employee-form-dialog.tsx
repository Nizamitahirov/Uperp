'use client';

import { useEffect, useState } from 'react';
import { Loader2, User, Briefcase, Wallet } from 'lucide-react';
import type { Department, Employee, Position } from '@/types';
import { ImageUpload } from '@/components/shared/image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Values = Record<string, unknown>;

const CONTRACT_TYPES = [['permanent', 'Daimi'], ['fixed_term', 'Müddətli'], ['part_time', 'Yarımştat'], ['intern', 'Təcrübəçi']] as const;
const STATUSES = [['active', 'Aktiv'], ['probation', 'Sınaq'], ['on_leave', 'Məzuniyyətdə'], ['suspended', 'Dayandırılmış'], ['terminated', 'İşdən çıxmış']] as const;
const PAY_TYPES = [['monthly', 'Aylıq'], ['daily', 'Günlük'], ['hourly', 'Saatlıq'], ['piece_rate', 'Ədədi (piece-rate)']] as const;

function toDateInput(ts: unknown): string {
  const ms = (ts as { toMillis?: () => number })?.toMillis?.();
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

export function EmployeeFormDialog({ open, onOpenChange, initial, departments, positions, employees, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: Employee | null;
  departments: Department[]; positions: Position[]; employees: Employee[];
  onSubmit: (v: Values) => void; submitting: boolean;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [avatar, setAvatar] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const i = initial;
    setF({
      firstName: i?.firstName ?? '', lastName: i?.lastName ?? '', gender: i?.gender ?? 'male',
      birthDate: toDateInput(i?.birthDate), nationalId: i?.nationalId ?? '', phone: i?.phone ?? '', email: i?.email ?? '', address: i?.address ?? '', emergencyContact: i?.emergencyContact ?? '',
      departmentId: i?.departmentId ?? '', positionId: i?.positionId ?? '', managerId: i?.managerId ?? '',
      hireDate: toDateInput(i?.hireDate), contractType: i?.contractType ?? 'permanent', contractEndDate: toDateInput(i?.contractEndDate),
      status: i?.status ?? 'active', workLocation: i?.workLocation ?? '',
      payType: i?.payType ?? 'monthly', baseSalary: String(i?.baseSalary ?? ''), annualLeaveEntitlement: String(i?.annualLeaveEntitlement ?? 30),
      bankName: i?.bankName ?? '', iban: i?.iban ?? '',
    });
    setAvatar(i?.avatarUrl ? [i.avatarUrl] : []);
  }, [open, initial]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.firstName?.trim()) return;
    const dep = departments.find((d) => d.id === f.departmentId);
    const pos = positions.find((p) => p.id === f.positionId);
    onSubmit({
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), gender: f.gender,
      birthDate: f.birthDate ? new Date(f.birthDate) : null, nationalId: f.nationalId || null,
      phone: f.phone || null, email: f.email || null, address: f.address || null, emergencyContact: f.emergencyContact || null,
      avatarUrl: avatar[0] ?? null,
      departmentId: f.departmentId || null, departmentName: dep?.name ?? null,
      positionId: f.positionId || null, positionTitle: pos?.title ?? null,
      managerId: f.managerId || null,
      hireDate: f.hireDate ? new Date(f.hireDate) : null, contractType: f.contractType,
      contractEndDate: f.contractEndDate ? new Date(f.contractEndDate) : null,
      status: f.status, workLocation: f.workLocation || null,
      payType: f.payType, baseSalary: +f.baseSalary || 0, annualLeaveEntitlement: +f.annualLeaveEntitlement || 0,
      bankName: f.bankName || null, iban: f.iban || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>{initial ? 'İşçini düzəlt' : 'Yeni işçi'}</DialogTitle></DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          {/* Şəxsi */}
          <Section icon={User} title="Şəxsi məlumatlar">
            <div className="mb-3"><Label className="mb-1.5 block">Şəkil</Label><ImageUpload path="avatars/employees" value={avatar} onChange={setAvatar} max={1} /></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad *"><Input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
              <Field label="Soyad"><Input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
              <Field label="Cins"><Sel value={f.gender} onChange={(v) => set('gender', v)} options={[['male', 'Kişi'], ['female', 'Qadın'], ['other', 'Digər']]} /></Field>
              <Field label="Doğum tarixi"><Input type="date" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
              <Field label="FIN / Şəxsiyyət"><Input value={f.nationalId} onChange={(e) => set('nationalId', e.target.value)} /></Field>
              <Field label="Telefon"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Təcili əlaqə"><Input value={f.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} /></Field>
              <div className="col-span-2"><Field label="Ünvan"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
            </div>
          </Section>

          {/* İş */}
          <Section icon={Briefcase} title="İş məlumatları">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Departament"><Sel value={f.departmentId} onChange={(v) => set('departmentId', v)} placeholder="Seç" options={departments.map((d) => [d.id, d.name])} allowNone /></Field>
              <Field label="Vəzifə"><Sel value={f.positionId} onChange={(v) => set('positionId', v)} placeholder="Seç" options={positions.map((p) => [p.id, p.title])} allowNone /></Field>
              <Field label="Rəhbər"><Sel value={f.managerId} onChange={(v) => set('managerId', v)} placeholder="Seç" options={employees.filter((e) => e.id !== initial?.id).map((e) => [e.id, e.fullName])} allowNone /></Field>
              <Field label="İşə qəbul tarixi"><Input type="date" value={f.hireDate} onChange={(e) => set('hireDate', e.target.value)} /></Field>
              <Field label="Müqavilə tipi"><Sel value={f.contractType} onChange={(v) => set('contractType', v)} options={CONTRACT_TYPES as unknown as [string, string][]} /></Field>
              <Field label="Müqavilə bitmə"><Input type="date" value={f.contractEndDate} onChange={(e) => set('contractEndDate', e.target.value)} /></Field>
              <Field label="Status"><Sel value={f.status} onChange={(v) => set('status', v)} options={STATUSES as unknown as [string, string][]} /></Field>
              <Field label="İş yeri"><Input value={f.workLocation} onChange={(e) => set('workLocation', e.target.value)} placeholder="Sex 1 / Ofis" /></Field>
            </div>
          </Section>

          {/* Əmək haqqı */}
          <Section icon={Wallet} title="Əmək haqqı">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ödəniş tipi"><Sel value={f.payType} onChange={(v) => set('payType', v)} options={PAY_TYPES as unknown as [string, string][]} /></Field>
              <Field label="Baza maaş / dərəcə (₼)"><Input type="number" step="any" value={f.baseSalary} onChange={(e) => set('baseSalary', e.target.value)} /></Field>
              <Field label="İllik məzuniyyət (gün)"><Input type="number" value={f.annualLeaveEntitlement} onChange={(e) => set('annualLeaveEntitlement', e.target.value)} /></Field>
              <Field label="Bank"><Input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} /></Field>
              <div className="col-span-2"><Field label="IBAN"><Input value={f.iban} onChange={(e) => set('iban', e.target.value)} placeholder="AZ.." /></Field></div>
            </div>
          </Section>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv</Button>
          <Button onClick={submit} disabled={submitting || !f.firstName?.trim()}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {title}</p>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Sel({ value, onChange, options, placeholder, allowNone }: { value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[]; placeholder?: string; allowNone?: boolean }) {
  return (
    <Select value={value || (allowNone ? '__none' : value)} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none">— yoxdur —</SelectItem>}
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
