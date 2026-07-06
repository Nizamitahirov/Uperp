import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createExpense } from './finance';
import { listDocs } from './firestore';
import { computePayslip, DEFAULT_PAYROLL_CONFIG, type PayrollConfig } from '@/lib/payroll';
import { buildTimesheet } from './attendance';
import type { Attendance, Employee, PayrollRun, PayrollRunStatus, Payslip, ProductionOperations, SalaryAdvance } from '@/types';

interface Actor { uid: string; username: string }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function fetchPayrollConfig(): Promise<PayrollConfig> {
  const snap = await getDoc(doc(getDb(), 'settings', 'payroll'));
  if (!snap.exists()) return DEFAULT_PAYROLL_CONFIG;
  return { ...DEFAULT_PAYROLL_CONFIG, ...(snap.data() as Partial<PayrollConfig>) };
}

export async function savePayrollConfig(config: PayrollConfig, actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), 'settings', 'payroll'), { ...config, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'PayrollConfig', entityId: 'payroll' });
}

const opMonthKey = (ts: unknown): string => {
  const ms = (ts as { toMillis?: () => number })?.toMillis?.();
  return ms ? new Date(ms).toISOString().slice(0, 7) : '';
};

/** Shop-floor əməliyyatlarından işçi üzrə ədədi (piece-rate) ödənişi yığır */
export async function aggregatePieceRate(employees: Employee[], period: string): Promise<Map<string, number>> {
  const opsDocs = await listDocs<ProductionOperations>('production_operations');
  const byName = new Map(employees.map((e) => [e.fullName, e]));
  const result = new Map<string, number>();
  for (const d of opsDocs) {
    for (const op of d.operations ?? []) {
      if (op.status !== 'done' || !op.operator) continue;
      if (opMonthKey(op.completedAt) !== period) continue;
      const emp = byName.get(op.operator);
      if (!emp) continue;
      const rate = emp.pieceRates?.[op.stage] ?? 0;
      if (rate <= 0) continue;
      result.set(emp.id, (result.get(emp.id) ?? 0) + (op.completedQty ?? 0) * rate);
    }
  }
  return result;
}

/** Dövr üçün əmək haqqı run-ı yaradır: hesablayır, payslip-ləri yazır, avansları tutur */
export async function createPayrollRun(period: string, actor: Actor): Promise<string> {
  const db = getDb();
  const [employees, attendance, advances, config] = await Promise.all([
    listDocs<Employee>('employees'),
    listDocs<Attendance>('attendance', []),
    listDocs<SalaryAdvance>('salary_advances', []),
    fetchPayrollConfig(),
  ]);
  const active = employees.filter((e) => e.status === 'active' || e.status === 'probation' || e.status === 'on_leave');
  const monthAtt = attendance.filter((a) => a.dateKey?.startsWith(period));
  const timesheet = buildTimesheet(monthAtt);
  const tsByEmp = new Map(timesheet.map((t) => [t.employeeId, t]));
  const openAdvByEmp = new Map<string, SalaryAdvance[]>();
  for (const a of advances.filter((x) => x.status === 'open')) {
    const arr = openAdvByEmp.get(a.employeeId) ?? []; arr.push(a); openAdvByEmp.set(a.employeeId, arr);
  }
  const pieceRate = await aggregatePieceRate(active, period);

  const number = await nextNumber('PAY');
  const runRef = doc(collection(db, 'payroll_runs'));
  const batch = writeBatch(db);

  let totalGross = 0, totalNet = 0, totalTax = 0, totalStatutory = 0, totalEmployerCost = 0, count = 0;

  for (const e of active) {
    const ts = tsByEmp.get(e.id);
    const allowances = r2((e.allowances ?? []).reduce((a, x) => a + (x.amount || 0), 0));
    const otherDeductions = r2((e.deductions ?? []).reduce((a, x) => a + (x.amount || 0), 0));
    const empAdvances = openAdvByEmp.get(e.id) ?? [];
    const advanceSum = r2(empAdvances.reduce((a, x) => a + (x.amount || 0), 0));

    const calc = computePayslip({
      payType: e.payType, baseSalary: e.baseSalary ?? 0,
      presentDays: ts?.presentDays ?? 0, halfDays: ts?.halfDays ?? 0, totalHours: ts?.totalHours ?? 0, overtimeHours: ts?.overtimeHours ?? 0,
      pieceRatePay: pieceRate.get(e.id) ?? 0, allowances, otherDeductions, advances: advanceSum,
    }, config);

    const psRef = doc(collection(db, 'payslips'));
    batch.set(psRef, {
      runId: runRef.id, period, employeeId: e.id, employeeName: e.fullName, userId: e.userId ?? null,
      payType: e.payType, presentDays: ts?.presentDays ?? 0, totalHours: ts?.totalHours ?? 0, overtimeHours: ts?.overtimeHours ?? 0,
      base: calc.base, overtime: calc.overtime, pieceRatePay: calc.pieceRatePay, allowances: calc.allowances, gross: calc.gross,
      incomeTax: calc.incomeTax, socialEmployee: calc.socialEmployee, unemploymentEmployee: calc.unemploymentEmployee, medicalEmployee: calc.medicalEmployee,
      otherDeductions: calc.otherDeductions, advances: calc.advances, totalDeductions: calc.totalDeductions,
      net: calc.net, employerContrib: calc.employerContrib, employerCost: calc.employerCost,
      bankName: e.bankName ?? null, iban: e.iban ?? null, createdAt: serverTimestamp(),
    });
    // Avansları tutulmuş kimi işarələ
    for (const adv of empAdvances) batch.update(doc(db, 'salary_advances', adv.id), { status: 'deducted', payslipId: psRef.id });

    totalGross += calc.gross; totalNet += calc.net; totalTax += calc.incomeTax;
    totalStatutory += calc.totalDeductions; totalEmployerCost += calc.employerCost; count += 1;
  }

  batch.set(runRef, {
    number, period, status: 'draft' as PayrollRunStatus, employeeCount: count,
    totalGross: r2(totalGross), totalNet: r2(totalNet), totalTax: r2(totalTax), totalStatutory: r2(totalStatutory), totalEmployerCost: r2(totalEmployerCost),
    createdBy: actor.uid, createdByName: actor.username, createdAt: serverTimestamp(),
  });

  await batch.commit();
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'PayrollRun', entityId: runRef.id });
  return runRef.id;
}

/** Run statusunu dəyişir. "paid"-də maliyyəyə əmək haqqı xərci post edir. */
export async function setRunStatus(run: PayrollRun, status: PayrollRunStatus, actor: Actor): Promise<void> {
  const db = getDb();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved') patch.approvedAt = serverTimestamp();
  if (status === 'paid' && run.status !== 'paid') {
    const expId = await createExpense(
      { category: 'salary', amount: run.totalEmployerCost, currency: 'AZN', paymentMethod: 'transfer', description: `Əmək haqqı — ${run.period} (${run.employeeCount} işçi)` },
      { uid: actor.uid, username: actor.username },
    );
    patch.postedExpenseId = expId;
    patch.paidAt = serverTimestamp();
  }
  await updateDoc(doc(db, 'payroll_runs', run.id), patch);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'PayrollRun', entityId: run.id });
}

/** İşçiyə avans (salary advance) əlavə edir */
export async function createAdvance(data: { employeeId: string; employeeName?: string; amount: number; note?: string }, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'salary_advances'), {
    employeeId: data.employeeId, employeeName: data.employeeName ?? null, amount: data.amount,
    date: serverTimestamp(), status: 'open', note: data.note ?? null, createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'SalaryAdvance', entityId: ref.id });
  return ref.id;
}
