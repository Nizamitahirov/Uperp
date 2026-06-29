'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { useAuth } from '@/components/providers/auth-provider';
import { isMine } from '@/lib/firebase/approvals';

/** Cari istifadəçiyə aid gözləyən təsdiq + açıq tapşırıq sayı (real-time) */
export function useInbox() {
  const { firebaseUser, role } = useAuth();
  const [approvals, setApprovals] = useState(0);
  const [tasks, setTasks] = useState(0);

  useEffect(() => {
    if (!firebaseUser || !role) { setApprovals(0); setTasks(0); return; }
    const uid = firebaseUser.uid;
    const mine = (d: { assigneeType: 'role' | 'user'; assigneeRole?: string | null; assigneeUserId?: string | null }) => isMine(d, uid, role);

    const qa = query(collection(getDb(), 'approval_requests'), where('status', '==', 'pending'));
    const qt = query(collection(getDb(), 'tasks'), where('status', '==', 'open'));

    const ua = onSnapshot(qa, (s) => setApprovals(s.docs.map((d) => d.data()).filter((d) => mine(d as never)).length), () => setApprovals(0));
    const ut = onSnapshot(qt, (s) => setTasks(s.docs.map((d) => d.data()).filter((d) => mine(d as never)).length), () => setTasks(0));
    return () => { ua(); ut(); };
  }, [firebaseUser, role]);

  return { approvals, tasks, total: approvals + tasks };
}
