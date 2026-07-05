import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { CustomRole } from '@/types';
import type { ModuleKey, PermissionAction, PermissionMatrix } from '@/lib/rbac/permissions';

interface Actor {
  uid: string;
  username: string;
}

export async function createCustomRole(
  params: { name: string; level: number; permissions: Record<ModuleKey, PermissionAction[]> },
  actor: Actor,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'roles'), {
    name: params.name,
    level: params.level,
    permissions: params.permissions,
    isCustom: true,
    createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Role', entityId: ref.id });
  return ref.id;
}

export async function deleteCustomRole(id: string, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), 'roles', id));
  await logAudit({ userId: actor.uid, username: actor.username, action: 'DELETE', entityType: 'Role', entityId: id });
}

/** Custom rolun permission map-ını gətirir (AuthProvider üçün) */
export async function fetchCustomRole(roleId: string): Promise<CustomRole | null> {
  const snap = await getDoc(doc(getDb(), 'roles', roleId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<CustomRole, 'id'>) };
}

/** Built-in rollar üçün redaktə edilmiş səlahiyyət matrisini gətirir */
export async function fetchRolePermissions(): Promise<PermissionMatrix | null> {
  const snap = await getDoc(doc(getDb(), 'settings', 'role_permissions'));
  if (!snap.exists()) return null;
  return (snap.data().matrix ?? null) as PermissionMatrix | null;
}

/** Səlahiyyət matrisini yadda saxlayır (Rol İdarəetməsi) */
export async function saveRolePermissions(matrix: PermissionMatrix, actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), 'settings', 'role_permissions'), { matrix, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Role', entityId: 'role_permissions' });
}
