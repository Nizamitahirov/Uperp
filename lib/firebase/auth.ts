import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb, googleProvider } from './config';
import { logAudit } from './audit';
import type { AppUser } from '@/types';

/** Daxili işçi girişi (email/parol) — 01 §1.1.1 */
export async function loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await afterLogin(cred.user);
  return cred.user;
}

/** Müştəri girişi (Gmail / Google OAuth) — 01 §1.1.2. İlk dəfədirsə customer profili yaradılır. */
export async function loginWithGoogle(): Promise<{ user: FirebaseUser; isNew: boolean }> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  const ref = doc(getDb(), 'users', user.uid);
  const snap = await getDoc(ref);
  let isNew = false;

  if (!snap.exists()) {
    isNew = true;
    const profile: Partial<AppUser> = {
      uid: user.uid,
      email: user.email ?? '',
      fullName: user.displayName ?? '',
      username: (user.email ?? user.uid).split('@')[0],
      avatarUrl: user.photoURL ?? undefined,
      role: 'customer',
      status: 'pending',
      isActive: true,
    };
    await setDoc(ref, { ...profile, createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
  } else {
    await updateDoc(ref, { lastLogin: serverTimestamp() });
  }

  await logAudit({
    userId: user.uid,
    username: user.email ?? user.uid,
    action: 'LOGIN',
    entityType: 'Auth',
    entityId: user.uid,
  });

  return { user, isNew };
}

async function afterLogin(user: FirebaseUser) {
  try {
    await updateDoc(doc(getDb(), 'users', user.uid), { lastLogin: serverTimestamp() });
  } catch {
    // profil hələ yoxdursa ötür
  }
  await logAudit({
    userId: user.uid,
    username: user.email ?? user.uid,
    action: 'LOGIN',
    entityType: 'Auth',
    entityId: user.uid,
  });
}

export async function logout(user?: { uid: string; email?: string | null } | null): Promise<void> {
  if (user) {
    await logAudit({
      userId: user.uid,
      username: user.email ?? user.uid,
      action: 'LOGOUT',
      entityType: 'Auth',
      entityId: user.uid,
    });
  }
  await fbSignOut(getFirebaseAuth());
}

/** Firestore-dan istifadəçi profilini (rol daxil) gətirir */
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<AppUser, 'uid'>) };
}
