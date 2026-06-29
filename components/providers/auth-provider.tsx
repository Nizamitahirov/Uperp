'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import { fetchUserProfile } from '@/lib/firebase/auth';
import { fetchCustomRole } from '@/lib/firebase/roles';
import type { AppUser, RoleCode } from '@/types';
import { can, canAccessModule, ROLES, type ModuleKey, type PermissionAction } from '@/lib/rbac/permissions';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  role: RoleCode | undefined;
  loading: boolean;
  configured: boolean;
  can: (module: ModuleKey, action: PermissionAction) => boolean;
  canAccess: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [customPerms, setCustomPerms] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const p = await fetchUserProfile(uid);
    setProfile(p);
    // Built-in deyilsə → custom rol permission-larını gətir (01 §1.2.2)
    if (p?.role && !(p.role in ROLES)) {
      try {
        const cr = await fetchCustomRole(p.role);
        setCustomPerms(cr?.permissions ?? null);
      } catch {
        setCustomPerms(null);
      }
    } else {
      setCustomPerms(null);
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await loadProfile(user.uid);
        } catch (e) {
          console.error('Profil yüklənmədi', e);
        }
      } else {
        setProfile(null);
        setCustomPerms(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const role = profile?.role;
  const isBuiltIn = role ? role in ROLES : false;

  function checkCan(module: ModuleKey, action: PermissionAction): boolean {
    if (isBuiltIn) return can(role, module, action);
    if (customPerms) return (customPerms[module] ?? []).includes(action);
    return false;
  }
  function checkAccess(module: ModuleKey): boolean {
    if (isBuiltIn) return canAccessModule(role, module);
    if (customPerms) return (customPerms[module] ?? []).length > 0;
    return false;
  }

  const value: AuthContextValue = {
    firebaseUser,
    profile,
    role,
    loading,
    configured: isFirebaseConfigured,
    can: checkCan,
    canAccess: checkAccess,
    refresh: async () => {
      if (firebaseUser) await loadProfile(firebaseUser.uid);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider daxilində istifadə olunmalıdır');
  return ctx;
}
