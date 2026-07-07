import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createEmployee } from './hr';
import type { Candidate, CandidateStage, ContractType, JobOpening, PayType } from '@/types';

interface Actor { uid: string; username: string }

export const OPENING_STATUS_LABELS: Record<JobOpening['status'], string> = {
  open: 'Açıq', on_hold: 'Gözləmədə', closed: 'Bağlı',
};

export const CANDIDATE_STAGES: { value: CandidateStage; label: string }[] = [
  { value: 'applied', label: 'Müraciət' },
  { value: 'screening', label: 'İlkin baxış' },
  { value: 'interview', label: 'Müsahibə' },
  { value: 'offer', label: 'Təklif' },
  { value: 'hired', label: 'İşə götürülüb' },
  { value: 'rejected', label: 'Rədd' },
];
export const CANDIDATE_STAGE_MAP = new Map(CANDIDATE_STAGES.map((s) => [s.value, s.label]));

// ── Vakansiyalar ────────────────────────────────────────────────────────
export async function createOpening(
  data: { title: string; departmentId?: string; departmentName?: string; positionId?: string; headcount: number; description?: string },
  actor: Actor,
): Promise<string> {
  const number = await nextNumber('JOB');
  const ref = await addDoc(collection(getDb(), 'job_openings'), {
    number, title: data.title,
    departmentId: data.departmentId ?? null, departmentName: data.departmentName ?? null,
    positionId: data.positionId ?? null, headcount: data.headcount, status: 'open' as const,
    description: data.description ?? null, createdBy: actor.uid, createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'JobOpening', entityId: ref.id });
  return ref.id;
}

export async function setOpeningStatus(id: string, status: JobOpening['status'], actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'job_openings', id), { status, ...(status === 'closed' ? { closedAt: serverTimestamp() } : {}) });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'JobOpening', entityId: id });
}

// ── Namizədlər ──────────────────────────────────────────────────────────
export async function createCandidate(
  data: { openingId: string; openingTitle?: string; fullName: string; email?: string; phone?: string; expectedSalary?: number; notes?: string },
  actor: Actor,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'candidates'), {
    openingId: data.openingId, openingTitle: data.openingTitle ?? null,
    fullName: data.fullName, email: data.email ?? null, phone: data.phone ?? null,
    stage: 'applied' as CandidateStage, expectedSalary: data.expectedSalary ?? null,
    notes: data.notes ?? null, createdBy: actor.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Candidate', entityId: ref.id });
  return ref.id;
}

export async function moveCandidate(c: Candidate, stage: CandidateStage, actor: Actor, rejectionReason?: string): Promise<void> {
  await updateDoc(doc(getDb(), 'candidates', c.id), {
    stage, rejectionReason: stage === 'rejected' ? (rejectionReason ?? null) : null, updatedAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Candidate', entityId: c.id });
}

/**
 * Namizədi işçi kartına çevirir. Yeni işçi yaradır, namizədi 'hired' edir və
 * vakansiyanın açıq yerini azaldır (0 olduqda bağlayır).
 */
export async function hireCandidate(
  c: Candidate,
  opening: JobOpening | undefined,
  params: {
    firstName: string; lastName: string; hireDate: string; contractType: ContractType;
    payType: PayType; baseSalary: number; departmentId?: string | null; departmentName?: string;
    positionId?: string | null; positionTitle?: string; annualLeaveEntitlement?: number;
  },
  actor: Actor,
): Promise<string> {
  const empId = await createEmployee({
    firstName: params.firstName, lastName: params.lastName,
    phone: c.phone, email: c.email,
    departmentId: params.departmentId ?? opening?.departmentId ?? null,
    departmentName: params.departmentName ?? opening?.departmentName,
    positionId: params.positionId ?? opening?.positionId ?? null,
    positionTitle: params.positionTitle,
    hireDate: new Date(`${params.hireDate}T00:00:00`) as unknown as null,
    contractType: params.contractType,
    status: 'probation',
    payType: params.payType, baseSalary: params.baseSalary,
    annualLeaveEntitlement: params.annualLeaveEntitlement ?? 0,
    leaveBalance: 0,
  }, actor);

  await updateDoc(doc(getDb(), 'candidates', c.id), { stage: 'hired' as CandidateStage, hiredEmployeeId: empId, updatedAt: serverTimestamp() });

  if (opening) {
    const left = Math.max(0, (opening.headcount ?? 1) - 1);
    await updateDoc(doc(getDb(), 'job_openings', opening.id), {
      headcount: left, ...(left === 0 ? { status: 'closed' as const, closedAt: serverTimestamp() } : {}),
    });
  }
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Employee', entityId: empId });
  return empId;
}
