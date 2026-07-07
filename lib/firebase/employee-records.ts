import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { DisciplinaryRecord, Employee, PayType } from '@/types';

interface Actor { uid: string; username: string }

export const DISCIPLINARY_CATEGORIES: { value: DisciplinaryRecord['category']; label: string }[] = [
  { value: 'note', label: 'Qeyd' },
  { value: 'warning', label: 'Xəbərdarlıq' },
  { value: 'reprimand', label: 'Töhmət' },
  { value: 'suspension', label: 'İşdən kənarlaşdırma' },
];
export const DISCIPLINARY_CATEGORY_MAP = new Map(DISCIPLINARY_CATEGORIES.map((d) => [d.value, d.label]));

/**
 * Maaş dəyişikliyi (revision). salary_history-ə yazır və işçinin cari maaşını/
 * ödəniş tipini yeniləyir. Beləliklə payroll həmişə cari məbləği götürür.
 */
export async function reviseSalary(
  emp: Employee,
  params: { effectiveDate: string; newSalary: number; newPayType?: PayType; reason?: string },
  actor: Actor,
): Promise<void> {
  const db = getDb();
  await addDoc(collection(db, 'salary_history'), {
    employeeId: emp.id, employeeName: emp.fullName, effectiveDate: params.effectiveDate,
    previousSalary: emp.baseSalary ?? 0, newSalary: params.newSalary,
    previousPayType: emp.payType, newPayType: params.newPayType ?? emp.payType,
    reason: params.reason ?? null, createdBy: actor.uid, createdByName: actor.username, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'employees', emp.id), {
    baseSalary: params.newSalary, ...(params.newPayType ? { payType: params.newPayType } : {}), updatedAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Employee', entityId: emp.id });
}

export async function addDisciplinary(
  emp: Employee,
  params: { date: string; category: DisciplinaryRecord['category']; subject: string; details?: string },
  actor: Actor,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'disciplinary_records'), {
    employeeId: emp.id, employeeName: emp.fullName, date: params.date, category: params.category,
    subject: params.subject, details: params.details ?? null,
    createdBy: actor.uid, createdByName: actor.username, createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'DisciplinaryRecord', entityId: ref.id });
  return ref.id;
}
