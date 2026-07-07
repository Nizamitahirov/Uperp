import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import { fetchHrConfig } from './hr-config';
import { fetchHolidays, buildHolidaySet, workingDaysBetween } from './holidays';
import { listDocs } from './firestore';
import type { Employee, LeaveRequest, LeaveStatus, LeaveTransaction } from '@/types';

interface Actor { uid: string; username: string }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function writeLedger(entry: Omit<LeaveTransaction, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(getDb(), 'leave_transactions'), { ...entry, createdAt: serverTimestamp() });
}

export const LEAVE_TYPES: { value: string; label: string; paid: boolean; affectsBalance: boolean }[] = [
  { value: 'annual', label: 'İllik məzuniyyət', paid: true, affectsBalance: true },
  { value: 'sick', label: 'Xəstəlik (bülleten)', paid: true, affectsBalance: false },
  { value: 'unpaid', label: 'Ödənişsiz', paid: false, affectsBalance: false },
  { value: 'marriage', label: 'Nikah', paid: true, affectsBalance: false },
  { value: 'bereavement', label: 'Yas', paid: true, affectsBalance: false },
  { value: 'maternity', label: 'Analıq / atalıq', paid: true, affectsBalance: false },
];

export const LEAVE_TYPE_MAP = new Map(LEAVE_TYPES.map((t) => [t.value, t]));

/** İki tarix arasında inklüziv gün sayı */
export function leaveDays(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export async function createLeaveRequest(
  data: { employeeId: string; employeeName?: string; userId?: string | null; type: string; startDate: string; endDate: string; reason?: string },
  actor: Actor,
): Promise<string> {
  const t = LEAVE_TYPE_MAP.get(data.type);
  // İş günü rejimi + balansa təsir edən növ üçün həftəsonu/bayramları xaric say
  const config = await fetchHrConfig();
  let days = leaveDays(data.startDate, data.endDate);
  if (config.leaveCountMode === 'working' && (t?.affectsBalance ?? false)) {
    const sets = buildHolidaySet(await fetchHolidays());
    const wd = workingDaysBetween(data.startDate, data.endDate, sets, config.weekendDays ?? [0, 6]);
    if (wd > 0) days = wd;
  }
  if (days <= 0) throw new Error('Tarix aralığı yanlışdır');
  const requestNumber = await nextNumber('LV');
  const ref = await addDoc(collection(getDb(), 'leave_requests'), {
    requestNumber,
    employeeId: data.employeeId,
    employeeName: data.employeeName ?? null,
    userId: data.userId ?? null,
    type: data.type,
    typeLabel: t?.label ?? data.type,
    paid: t?.paid ?? true,
    affectsBalance: t?.affectsBalance ?? false,
    startDate: new Date(`${data.startDate}T00:00:00`),
    endDate: new Date(`${data.endDate}T00:00:00`),
    days,
    reason: data.reason ?? null,
    status: 'pending' as LeaveStatus,
    createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'LeaveRequest', entityId: ref.id });
  await createNotification({
    type: 'LEAVE_REQUEST', severity: 'info',
    title: { az: `Yeni məzuniyyət sorğusu (${requestNumber})`, en: `New leave request (${requestNumber})` },
    message: { az: `${data.employeeName ?? 'İşçi'} ${days} gün ${t?.label ?? data.type} sorğusu göndərdi.`, en: `${data.employeeName ?? 'Employee'} requested ${days} days.` },
    recipientRoles: ['director', 'hr_manager'], entityType: 'LeaveRequest', entityId: ref.id, actionUrl: '/hr/leave',
  }).catch(() => {});
  return ref.id;
}

/** Sorğunun statusunu dəyişir. Təsdiqdə (annual) balansı tutur; rədd/ləğvdə geri qaytarır. */
export async function setLeaveStatus(req: LeaveRequest, status: LeaveStatus, actor: Actor, note?: string): Promise<void> {
  const db = getDb();

  // Balansa təsir edən növ üçün təsdiq → tutulma
  if (status === 'approved' && req.status !== 'approved' && req.affectsBalance) {
    const empRef = doc(db, 'employees', req.employeeId);
    const newBal = await runTransaction(db, async (tx) => {
      const snap = await tx.get(empRef);
      if (!snap.exists()) return null;
      const e = snap.data() as Employee;
      const bal = e.leaveBalance ?? e.annualLeaveEntitlement ?? 0;
      const nb = Math.max(0, bal - req.days);
      tx.update(empRef, { leaveBalance: nb, updatedAt: serverTimestamp() });
      return nb;
    });
    if (newBal !== null) await writeLedger({ employeeId: req.employeeId, employeeName: req.employeeName, type: 'usage', days: -req.days, balanceAfter: newBal, refId: req.id, note: req.typeLabel, createdBy: actor.uid, createdByName: actor.username });
  }
  // Təsdiqlənmiş sorğu ləğv/rədd olunursa balansı geri qaytar
  if ((status === 'cancelled' || status === 'rejected') && req.status === 'approved' && req.affectsBalance) {
    const empRef = doc(db, 'employees', req.employeeId);
    const newBal = await runTransaction(db, async (tx) => {
      const snap = await tx.get(empRef);
      if (!snap.exists()) return null;
      const e = snap.data() as Employee;
      const nb = (e.leaveBalance ?? 0) + req.days;
      tx.update(empRef, { leaveBalance: nb, updatedAt: serverTimestamp() });
      return nb;
    });
    if (newBal !== null) await writeLedger({ employeeId: req.employeeId, employeeName: req.employeeName, type: 'reversal', days: req.days, balanceAfter: newBal, refId: req.id, note: 'Sorğu ləğvi', createdBy: actor.uid, createdByName: actor.username });
  }

  await updateDoc(doc(db, 'leave_requests', req.id), {
    status, decidedBy: actor.uid, decidedByName: actor.username, decidedAt: serverTimestamp(), decisionNote: note ?? null,
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'APPROVE', entityType: 'LeaveRequest', entityId: req.id });
}

const daysInMonth = (period: string) => { const [y, m] = period.split('-').map(Number); return new Date(y, m, 0).getDate(); };

export interface AccrualResult { employees: number; totalDays: number; skipped: number }

/**
 * Dövr üçün məzuniyyət toplanması (kumulyativ). İdempotent: hər işçi-dövr üçün
 * bir dəfə. Aylıq metod: illik norma/12; günlük metod: illik/365 × ayın günləri.
 * Carryover cap varsa balans onunla məhdudlaşır.
 */
export async function accrueLeaveForPeriod(period: string, actor: Actor): Promise<AccrualResult> {
  const db = getDb();
  const config = await fetchHrConfig();
  if (config.leaveAccrualMethod === 'none') return { employees: 0, totalDays: 0, skipped: 0 };
  const employees = await listDocs<Employee>('employees', []);
  const active = employees.filter((e) => e.status === 'active' || e.status === 'probation' || e.status === 'on_leave');
  const cap = config.leaveCarryoverCap;
  let count = 0, totalDays = 0, skipped = 0;

  for (const e of active) {
    const entitlement = e.annualLeaveEntitlement ?? 0;
    if (entitlement <= 0) continue;
    const accrual = config.leaveAccrualMethod === 'daily'
      ? r2((entitlement / 365) * daysInMonth(period))
      : r2(entitlement / 12);
    if (accrual <= 0) continue;

    const accrualRef = doc(db, 'leave_accruals', `${e.id}_${period}`);
    const exists = await getDoc(accrualRef);
    if (exists.exists()) { skipped++; continue; }

    const empRef = doc(db, 'employees', e.id);
    const applied = await runTransaction(db, async (tx) => {
      const snap = await tx.get(empRef);
      if (!snap.exists()) return 0;
      const cur = (snap.data() as Employee).leaveBalance ?? entitlement;
      const target = cap != null ? Math.min(cur + accrual, cap) : cur + accrual;
      const add = r2(Math.max(0, target - cur));
      if (add <= 0) return 0;
      tx.update(empRef, { leaveBalance: r2(target), updatedAt: serverTimestamp() });
      tx.set(accrualRef, { employeeId: e.id, period, days: add, method: config.leaveAccrualMethod, balanceAfter: r2(target), createdAt: serverTimestamp() });
      return add;
    });
    if (applied > 0) {
      await writeLedger({ employeeId: e.id, employeeName: e.fullName, type: 'accrual', days: applied, period, note: `${period} toplanma`, createdBy: actor.uid, createdByName: actor.username });
      count++; totalDays = r2(totalDays + applied);
    } else skipped++;
  }
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'LeaveAccrual', entityId: period });
  return { employees: count, totalDays, skipped };
}

/** Balans korreksiyası (opening/düzəliş) */
export async function adjustLeaveBalance(emp: Employee, days: number, note: string, actor: Actor): Promise<void> {
  const db = getDb();
  const empRef = doc(db, 'employees', emp.id);
  const newBal = await runTransaction(db, async (tx) => {
    const snap = await tx.get(empRef);
    if (!snap.exists()) return null;
    const nb = r2((((snap.data() as Employee).leaveBalance ?? 0)) + days);
    tx.update(empRef, { leaveBalance: nb, updatedAt: serverTimestamp() });
    return nb;
  });
  if (newBal !== null) await writeLedger({ employeeId: emp.id, employeeName: emp.fullName, type: 'adjustment', days, balanceAfter: newBal, note, createdBy: actor.uid, createdByName: actor.username });
}
