import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { CustomRole } from '@/types';
import type { ModuleKey, PermissionAction } from '@/lib/rbac/permissions';

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
