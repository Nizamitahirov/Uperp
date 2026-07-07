import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { HrConfig } from '@/types';

interface Actor { uid: string; username: string }

export const DEFAULT_HR_CONFIG: HrConfig = {
  leaveAccrualMethod: 'monthly',
  leaveCarryoverCap: null,
  seniorityTiers: [
    { years: 1, percent: 2 },
    { years: 3, percent: 5 },
    { years: 5, percent: 10 },
    { years: 10, percent: 15 },
  ],
};

export async function fetchHrConfig(): Promise<HrConfig> {
  const snap = await getDoc(doc(getDb(), 'settings', 'hr'));
  if (!snap.exists()) return DEFAULT_HR_CONFIG;
  const d = snap.data() as Partial<HrConfig>;
  return { ...DEFAULT_HR_CONFIG, ...d, seniorityTiers: d.seniorityTiers ?? DEFAULT_HR_CONFIG.seniorityTiers };
}

export async function saveHrConfig(config: HrConfig, actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), 'settings', 'hr'), { ...config, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'HrConfig', entityId: 'hr' });
}

/** İşə qəbul tarixindən keçən tam illər */
export function yearsOfService(hireDate: unknown, at: Date = new Date()): number {
  const ms = (hireDate as { toMillis?: () => number })?.toMillis?.() ?? (hireDate instanceof Date ? hireDate.getTime() : 0);
  if (!ms) return 0;
  const years = (at.getTime() - ms) / (365.25 * 86_400_000);
  return Math.max(0, Math.floor(years));
}

/** Staja görə tətbiq olunan əlavə faizi (ən yüksək uyğun pillə) */
export function seniorityPercent(years: number, tiers: HrConfig['seniorityTiers']): number {
  let pct = 0;
  for (const t of [...tiers].sort((a, b) => a.years - b.years)) {
    if (years >= t.years) pct = t.percent;
  }
  return pct;
}
