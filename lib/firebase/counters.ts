import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from './config';

/**
 * Atomik ardıcıl nömrə generatoru (PO-2026-0001 və s.).
 * `counters/{key}` sənədində illik sayğac saxlanır.
 */
export async function nextNumber(prefix: string, key?: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterKey = `${key ?? prefix}-${year}`;
  const ref = doc(getDb(), 'counters', counterKey);

  const seq = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(ref, { value: next, prefix, year, updatedAt: Date.now() }, { merge: true });
    return next;
  });

  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
