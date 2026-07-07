import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import type { HrRequest, HrRequestType } from '@/types';

interface Actor { uid: string; username: string }

export const HR_REQUEST_TYPES: { value: HrRequestType; label: string }[] = [
  { value: 'certificate', label: 'Arayış (iş yeri / gəlir)' },
  { value: 'data_change', label: 'Məlumat düzəlişi' },
  { value: 'other', label: 'Digər' },
];
export const HR_REQUEST_TYPE_MAP = new Map(HR_REQUEST_TYPES.map((t) => [t.value, t.label]));

export const HR_REQUEST_STATUS_META: Record<HrRequest['status'], { label: string; variant: 'warning' | 'default' | 'success' | 'destructive' }> = {
  pending: { label: 'Gözləyir', variant: 'warning' },
  in_progress: { label: 'İcrada', variant: 'default' },
  done: { label: 'Tamamlandı', variant: 'success' },
  rejected: { label: 'Rədd', variant: 'destructive' },
};

export async function createHrRequest(
  data: { employeeId: string; employeeName?: string; userId?: string | null; type: HrRequestType; subject: string; details?: string },
  actor: Actor,
): Promise<string> {
  const number = await nextNumber('REQ');
  const ref = await addDoc(collection(getDb(), 'hr_requests'), {
    number, employeeId: data.employeeId, employeeName: data.employeeName ?? null, userId: data.userId ?? null,
    type: data.type, subject: data.subject, details: data.details ?? null,
    status: 'pending' as HrRequest['status'], createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'HrRequest', entityId: ref.id });
  await createNotification({
    type: 'HR_REQUEST', severity: 'info',
    title: { az: `Yeni HR sorğusu (${number})`, en: `New HR request (${number})` },
    message: { az: `${data.employeeName ?? 'İşçi'}: ${data.subject}`, en: `${data.employeeName ?? 'Employee'}: ${data.subject}` },
    recipientRoles: ['director', 'hr_manager'], entityType: 'HrRequest', entityId: ref.id, actionUrl: '/hr',
  }).catch(() => {});
  return ref.id;
}

export async function setHrRequestStatus(req: HrRequest, status: HrRequest['status'], actor: Actor, response?: string): Promise<void> {
  await updateDoc(doc(getDb(), 'hr_requests', req.id), {
    status, response: response ?? req.response ?? null,
    handledBy: actor.uid, handledByName: actor.username, handledAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'HrRequest', entityId: req.id });
}
