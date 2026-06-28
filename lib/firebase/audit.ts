import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import type { AuditLog } from '@/types';

type AuditInput = {
  userId: string;
  username: string;
  action: AuditLog['action'];
  entityType: string;
  entityId: string;
  changes?: { before: unknown; after: unknown };
};

/** Audit log yazır (01 §1.5). Xəta baş verərsə sakitcə ötürülür — əsas əməliyyatı bloklamasın. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await addDoc(collection(getDb(), 'audit_logs'), {
      ...input,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
  } catch (err) {
    console.error('Audit log yazıla bilmədi:', err);
  }
}
