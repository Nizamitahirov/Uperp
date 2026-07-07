/**
 * Əmək haqqı hesablama motoru (Azərbaycan, konfiqurasiyalı).
 * Bütün dərəcələr marjinal bracket-lərlə ifadə olunur — qanun dəyişəndə
 * Settings-dən (settings/payroll) redaktə olunur. Defaultlar 2024–25 özəl
 * (qeyri-neft) sektor üçün təxminidir; yekun dərəcələri istifadəçi təsdiqləyir.
 */

export interface Bracket { upTo: number | null; rate: number }

export interface PayrollConfig {
  incomeTax: Bracket[];
  socialEmployee: Bracket[];
  socialEmployer: Bracket[];
  unemploymentEmployee: Bracket[];
  unemploymentEmployer: Bracket[];
  medicalEmployee: Bracket[];
  medicalEmployer: Bracket[];
  overtimeMultiplier: number;
  monthlyStandardHours: number;
  workingDaysPerMonth: number;
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  incomeTax: [{ upTo: 8000, rate: 0 }, { upTo: null, rate: 14 }],
  socialEmployee: [{ upTo: 200, rate: 3 }, { upTo: null, rate: 10 }],
  socialEmployer: [{ upTo: 200, rate: 22 }, { upTo: null, rate: 15 }],
  unemploymentEmployee: [{ upTo: null, rate: 0.5 }],
  unemploymentEmployer: [{ upTo: null, rate: 0.5 }],
  medicalEmployee: [{ upTo: 8000, rate: 2 }, { upTo: null, rate: 0.5 }],
  medicalEmployer: [{ upTo: 8000, rate: 2 }, { upTo: null, rate: 0.5 }],
  overtimeMultiplier: 1.5,
  monthlyStandardHours: 176,
  workingDaysPerMonth: 22,
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Marjinal bracket qiymətləndirici */
export function evalBrackets(amount: number, brackets: Bracket[]): number {
  if (amount <= 0) return 0;
  let total = 0;
  let prev = 0;
  for (const b of brackets) {
    const cap = b.upTo == null ? Infinity : b.upTo;
    if (amount <= prev) break;
    const slice = Math.min(amount, cap) - prev;
    if (slice > 0) total += slice * (b.rate / 100);
    prev = cap;
    if (cap === Infinity) break;
  }
  return r2(total);
}

export interface StatutoryResult {
  incomeTax: number;
  socialEmployee: number;
  unemploymentEmployee: number;
  medicalEmployee: number;
  socialEmployer: number;
  unemploymentEmployer: number;
  medicalEmployer: number;
  employeeStatutory: number; // işçidən tutulan cəmi (vergi + sosial + işsizlik + tibbi)
  employerContrib: number; // işəgötürən əlavə töhfələri
}

export function computeStatutory(gross: number, config: PayrollConfig): StatutoryResult {
  const incomeTax = evalBrackets(gross, config.incomeTax);
  const socialEmployee = evalBrackets(gross, config.socialEmployee);
  const unemploymentEmployee = evalBrackets(gross, config.unemploymentEmployee);
  const medicalEmployee = evalBrackets(gross, config.medicalEmployee);
  const socialEmployer = evalBrackets(gross, config.socialEmployer);
  const unemploymentEmployer = evalBrackets(gross, config.unemploymentEmployer);
  const medicalEmployer = evalBrackets(gross, config.medicalEmployer);
  return {
    incomeTax, socialEmployee, unemploymentEmployee, medicalEmployee,
    socialEmployer, unemploymentEmployer, medicalEmployer,
    employeeStatutory: r2(incomeTax + socialEmployee + unemploymentEmployee + medicalEmployee),
    employerContrib: r2(socialEmployer + unemploymentEmployer + medicalEmployer),
  };
}

export interface GrossInput {
  payType: 'monthly' | 'daily' | 'hourly' | 'piece_rate';
  baseSalary: number;
  presentDays: number;
  halfDays: number;
  totalHours: number;
  overtimeHours: number;
  pieceRatePay: number; // shop-floor-dan yığılmış
  allowances: number;
  seniority: number; // staj əlavəsi (məbləğ)
  bonus: number; // birdəfəlik bonus
}

/** Ödəniş tipinə görə brüt maaşı hesablayır */
export function computeGross(i: GrossInput, config: PayrollConfig): { base: number; overtime: number; gross: number } {
  let base = 0;
  const hourly = config.monthlyStandardHours > 0 ? i.baseSalary / config.monthlyStandardHours : 0;
  switch (i.payType) {
    case 'monthly': base = i.baseSalary; break;
    case 'daily': base = i.baseSalary * (i.presentDays + i.halfDays * 0.5); break;
    case 'hourly': base = i.baseSalary * i.totalHours; break;
    case 'piece_rate': base = i.pieceRatePay; break;
  }
  const overtime = i.payType === 'monthly' || i.payType === 'hourly' ? r2(i.overtimeHours * hourly * config.overtimeMultiplier) : 0;
  const gross = r2(base + overtime + i.allowances + i.seniority + i.bonus);
  return { base: r2(base), overtime, gross };
}

export interface PayslipCalc {
  base: number; overtime: number; pieceRatePay: number; allowances: number; seniorityAllowance: number; bonus: number; gross: number;
  incomeTax: number; socialEmployee: number; unemploymentEmployee: number; medicalEmployee: number;
  otherDeductions: number; advances: number; loanDeduction: number; totalDeductions: number;
  net: number; employerContrib: number; employerCost: number;
}

export function computePayslip(i: GrossInput & { otherDeductions: number; advances: number; loanDeduction: number }, config: PayrollConfig): PayslipCalc {
  const { base, overtime, gross } = computeGross(i, config);
  const s = computeStatutory(gross, config);
  const totalDeductions = r2(s.employeeStatutory + i.otherDeductions + i.advances + i.loanDeduction);
  const net = r2(gross - totalDeductions);
  return {
    base, overtime, pieceRatePay: i.payType === 'piece_rate' ? base : 0, allowances: i.allowances, seniorityAllowance: i.seniority, bonus: i.bonus, gross,
    incomeTax: s.incomeTax, socialEmployee: s.socialEmployee, unemploymentEmployee: s.unemploymentEmployee, medicalEmployee: s.medicalEmployee,
    otherDeductions: i.otherDeductions, advances: i.advances, loanDeduction: i.loanDeduction, totalDeductions,
    net, employerContrib: s.employerContrib, employerCost: r2(gross + s.employerContrib),
  };
}
