import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { listDocs } from './firestore';
import type { Employee, SalaryAdvance } from '@/types';

interface Actor { uid: string; username: string }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** İşçinin günlük dərəcəsini təxmin edir (yekun haqq-hesab üçün) */
export function dailyRateOf(e: Pick<Employee, 'payType' | 'baseSalary'>): number {
  switch (e.payType) {
    case 'daily': return e.baseSalary ?? 0;
    case 'hourly': return (e.baseSalary ?? 0) * 8;
    case 'piece_rate': return 0;
    default: return r2((e.baseSalary ?? 0) / 22); // aylıq → 22 iş günü
  }
}

export interface SettlementPreview {
  unusedLeaveDays: number; dailyRate: number; leaveEncashment: number; deductions: number; netSettlement: number;
}

/** Yekun haqq-hesab önizləməsi (məzuniyyət kompensasiyası − açıq avanslar) */
export async function previewSettlement(e: Employee): Promise<SettlementPreview> {
  const advances = await listDocs<SalaryAdvance>('salary_advances', []);
  const deductions = r2(advances.filter((a) => a.employeeId === e.id && a.status === 'open').reduce((s, a) => s + (a.amount || 0), 0));
  const unusedLeaveDays = e.leaveBalance ?? e.annualLeaveEntitlement ?? 0;
  const dailyRate = dailyRateOf(e);
  const leaveEncashment = r2(unusedLeaveDays * dailyRate);
  return { unusedLeaveDays, dailyRate, leaveEncashment, deductions, netSettlement: r2(leaveEncashment - deductions) };
}

/** İşçini işdən çıxarır və yekun haqq-hesab (settlement) sənədi yaradır */
export async function terminateEmployee(e: Employee, params: { terminationDate: string; reason?: string; note?: string }, actor: Actor): Promise<string> {
  const db = getDb();
  const preview = await previewSettlement(e);
  const settlementRef = await addDoc(collection(db, 'settlements'), {
    employeeId: e.id, employeeName: e.fullName, terminationDate: new Date(`${params.terminationDate}T00:00:00`), reason: params.reason ?? null,
    payType: e.payType, ...preview, note: params.note ?? null, createdBy: actor.uid, createdByName: actor.username, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'employees', e.id), {
    status: 'terminated', terminationDate: new Date(`${params.terminationDate}T00:00:00`), terminationReason: params.reason ?? null, updatedAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Employee', entityId: e.id });
  return settlementRef.id;
}

type EmployeeInput = Omit<Employee, 'id' | 'employeeNo' | 'fullName' | 'createdAt' | 'updatedAt'>;

function fullNameOf(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

export async function createEmployee(data: EmployeeInput, actor: Actor): Promise<string> {
  const employeeNo = await nextNumber('EMP');
  const ref = await addDoc(collection(getDb(), 'employees'), {
    ...data,
    employeeNo,
    fullName: fullNameOf(data.firstName, data.lastName),
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Employee', entityId: ref.id });
  return ref.id;
}

export async function updateEmployee(id: string, data: Partial<EmployeeInput>, actor: Actor): Promise<void> {
  const patch: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.firstName !== undefined || data.lastName !== undefined) {
    patch.fullName = fullNameOf(data.firstName, data.lastName);
  }
  await updateDoc(doc(getDb(), 'employees', id), patch);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Employee', entityId: id });
}

export async function deleteEmployee(id: string, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), 'employees', id));
  await logAudit({ userId: actor.uid, username: actor.username, action: 'DELETE', entityType: 'Employee', entityId: id });
}

/** İşçini istifadəçi hesabı ilə bağlayır (ESS üçün) */
export async function linkEmployeeUser(employeeId: string, userId: string | null, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'employees', employeeId), { userId, updatedAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Employee', entityId: employeeId });
}
