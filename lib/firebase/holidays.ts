import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { listDocs } from './firestore';
import { logAudit } from './audit';
import type { Holiday } from '@/types';

interface Actor { uid: string; username: string }

export const HOLIDAY_TYPE_LABELS: Record<Holiday['type'], string> = {
  public: 'Dövlət bayramı',
  company: 'Şirkət',
  religious: 'Dini',
};

export async function fetchHolidays(): Promise<Holiday[]> {
  const rows = await listDocs<Holiday>('holidays', []);
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveHoliday(h: { date: string; name: string; type: Holiday['type']; recurring?: boolean }, actor: Actor): Promise<void> {
  const id = h.date; // idempotent: bir tarixdə bir bayram
  await setDoc(doc(getDb(), 'holidays', id), {
    date: h.date, name: h.name, type: h.type, recurring: h.recurring ?? false,
    createdAt: serverTimestamp(), createdBy: actor.uid,
  }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Holiday', entityId: id });
}

export async function deleteHoliday(id: string, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), 'holidays', id));
  await logAudit({ userId: actor.uid, username: actor.username, action: 'DELETE', entityType: 'Holiday', entityId: id });
}

/** Bayram günlərini "MM-DD" (recurring) və "YYYY-MM-DD" (dəqiq) dəstlərinə çevirir */
export function buildHolidaySet(holidays: Holiday[]): { exact: Set<string>; recurring: Set<string> } {
  const exact = new Set<string>();
  const recurring = new Set<string>();
  for (const h of holidays) {
    if (h.recurring) recurring.add(h.date.slice(5)); // MM-DD
    else exact.add(h.date);
  }
  return { exact, recurring };
}

/** Verilən tarix (YYYY-MM-DD) bayramdırmı */
export function isHolidayDate(dateKey: string, sets: { exact: Set<string>; recurring: Set<string> }): boolean {
  return sets.exact.has(dateKey) || sets.recurring.has(dateKey.slice(5));
}

/**
 * İş günü sayır (start..end inklüziv, həftəsonu və bayramları xaric).
 * weekendDays: 0=Bazar … 6=Şənbə.
 */
export function workingDaysBetween(start: string, end: string, sets: { exact: Set<string>; recurring: Set<string> }, weekendDays: number[] = [0, 6]): number {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  const weekend = new Set(weekendDays);
  let count = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (weekend.has(d.getDay())) continue;
    if (isHolidayDate(key, sets)) continue;
    count++;
  }
  return count;
}
