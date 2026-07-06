import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import type { Employee, LeaveRequest, LeaveStatus } from '@/types';

interface Actor { uid: string; username: string }

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
  const days = leaveDays(data.startDate, data.endDate);
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
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(empRef);
      if (!snap.exists()) return;
      const e = snap.data() as Employee;
      const bal = e.leaveBalance ?? e.annualLeaveEntitlement ?? 0;
      tx.update(empRef, { leaveBalance: Math.max(0, bal - req.days), updatedAt: serverTimestamp() });
    });
  }
  // Təsdiqlənmiş sorğu ləğv/rədd olunursa balansı geri qaytar
  if ((status === 'cancelled' || status === 'rejected') && req.status === 'approved' && req.affectsBalance) {
    const empRef = doc(db, 'employees', req.employeeId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(empRef);
      if (!snap.exists()) return;
      const e = snap.data() as Employee;
      tx.update(empRef, { leaveBalance: (e.leaveBalance ?? 0) + req.days, updatedAt: serverTimestamp() });
    });
  }

  await updateDoc(doc(db, 'leave_requests', req.id), {
    status, decidedBy: actor.uid, decidedByName: actor.username, decidedAt: serverTimestamp(), decisionNote: note ?? null,
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'APPROVE', entityType: 'LeaveRequest', entityId: req.id });
}
