'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import type { AppNotification } from '@/types';

/** Cari istifadəçinin roluna görə real-time bildiriş axını (13 §13.4) */
export function useNotifications(max = 30) {
  const { role, firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || !firebaseUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(getDb(), 'notifications'),
      where('recipientRoles', 'array-contains', role),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AppNotification[]);
        setLoading(false);
      },
      (err) => {
        console.error('Bildiriş axını xətası:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [role, firebaseUser, max]);

  const uid = firebaseUser?.uid;
  const unreadCount = notifications.filter((n) => !(n.readBy ?? []).includes(uid ?? '')).length;

  return { notifications, unreadCount, loading };
}
