import { doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { Attendance, AttendanceStatus } from '@/types';

interface Actor { uid: string; username: string }

export interface AttendanceEntry {
  employeeId: string;
  employeeName?: string;
  userId?: string | null;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked: number;
  overtimeHours: number;
  note?: string;
}

export function attendanceId(employeeId: string, dateKey: string): string {
  return `${employeeId}_${dateKey}`;
}

/** Bir gün üçün davamiyyəti toplu yazır (upsert, idempotent doc id) */
export async function saveAttendance(dateKey: string, entries: AttendanceEntry[], actor: Actor): Promise<number> {
  const db = getDb();
  const batch = writeBatch(db);
  const date = Timestamp.fromDate(new Date(`${dateKey}T00:00:00`));
  let n = 0;
  for (const e of entries) {
    const ref = doc(db, 'attendance', attendanceId(e.employeeId, dateKey));
    batch.set(ref, {
      employeeId: e.employeeId,
      employeeName: e.employeeName ?? null,
      userId: e.userId ?? null,
      date,
      dateKey,
      status: e.status,
      checkIn: e.checkIn ?? null,
      checkOut: e.checkOut ?? null,
      hoursWorked: e.hoursWorked ?? 0,
      overtimeHours: e.overtimeHours ?? 0,
      note: e.note ?? null,
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    n++;
  }
  await batch.commit();
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Attendance', entityId: `day:${dateKey}` });
  return n;
}

/** Aylıq timesheet aqreqasiyası (davamiyyət qeydlərindən) */
export interface TimesheetRow {
  employeeId: string; employeeName: string;
  presentDays: number; halfDays: number; absentDays: number; leaveDays: number;
  totalHours: number; overtimeHours: number;
}

export function buildTimesheet(records: Attendance[]): TimesheetRow[] {
  const map = new Map<string, TimesheetRow>();
  for (const r of records) {
    const row = map.get(r.employeeId) ?? { employeeId: r.employeeId, employeeName: r.employeeName ?? r.employeeId, presentDays: 0, halfDays: 0, absentDays: 0, leaveDays: 0, totalHours: 0, overtimeHours: 0 };
    if (r.status === 'present' || r.status === 'remote') row.presentDays += 1;
    else if (r.status === 'half_day') row.halfDays += 1;
    else if (r.status === 'absent') row.absentDays += 1;
    else if (r.status === 'leave') row.leaveDays += 1;
    row.totalHours += r.hoursWorked ?? 0;
    row.overtimeHours += r.overtimeHours ?? 0;
    map.set(r.employeeId, row);
  }
  return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
