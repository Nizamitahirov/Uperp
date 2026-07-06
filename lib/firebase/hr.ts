import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import type { Employee } from '@/types';

interface Actor { uid: string; username: string }

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
