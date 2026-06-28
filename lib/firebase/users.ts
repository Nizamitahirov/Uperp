import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth, getSecondaryAuth } from './config';
import { logAudit } from './audit';
import type { AppUser, RoleCode } from '@/types';
import type { UserFormValues } from '@/lib/validations';

interface ActorInfo {
  uid: string;
  username: string;
}

/**
 * Yeni istifadəçi yaradır (01 §1.4.1):
 * 1. Secondary app ilə Firebase Auth user yaradılır (admin sessiyası qorunur)
 * 2. Firestore `users/{uid}` profili yazılır
 * 3. Audit log
 */
export async function createUserAccount(values: UserFormValues, actor: ActorInfo): Promise<string> {
  const { auth: secondaryAuth, cleanup } = getSecondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, values.email, values.password);
    const uid = cred.user.uid;

    try {
      await updateProfile(cred.user, { displayName: values.fullName });
    } catch {
      /* önəmli deyil */
    }

    const profile: Omit<AppUser, 'lastLogin'> = {
      uid,
      username: values.username,
      email: values.email,
      fullName: values.fullName,
      phone: values.phone || undefined,
      role: values.role as RoleCode,
      isActive: values.isActive,
      status: values.isActive ? 'active' : 'inactive',
      notificationPrefs: { channels: ['in_app'], types: [] },
    };

    await setDoc(doc(getDb(), 'users', uid), {
      ...profile,
      createdAt: serverTimestamp(),
      lastLogin: null,
    });

    await signOut(secondaryAuth);

    await logAudit({
      userId: actor.uid,
      username: actor.username,
      action: 'CREATE',
      entityType: 'User',
      entityId: uid,
    });

    return uid;
  } finally {
    await cleanup();
  }
}

/** İstifadəçi profilini yeniləyir (uid, username, createdAt dəyişməz — 01 §1.4.4) */
export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<AppUser, 'fullName' | 'phone' | 'role' | 'isActive' | 'status' | 'avatarUrl'>>,
  actor: ActorInfo,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', uid), { ...data });
  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: 'UPDATE',
    entityType: 'User',
    entityId: uid,
  });
}

/** Soft-delete (tövsiyə olunan): isActive=false */
export async function deactivateUser(uid: string, actor: ActorInfo): Promise<void> {
  await updateDoc(doc(getDb(), 'users', uid), { isActive: false, status: 'inactive' });
  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: 'UPDATE',
    entityType: 'User',
    entityId: uid,
  });
}

/** Parol sıfırlama emaili göndərir (Firebase Auth) */
export async function sendUserPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}
