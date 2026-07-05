/**
 * IFRS/BAS uyğun maliyyə hesabatlarının qurulması (tək dövr snapshotu).
 * IAS 1 (Maliyyə hesabatlarının təqdimatı) və IAS 7 (Pul vəsaitlərinin hərəkəti)
 * strukturuna uyğun sətir maddələri hazırlayır.
 *
 * Qeyd: Açılış qalıqları izlənmədiyindən uzunmüddətli aktivlər/amortizasiya sıfır
 * qəbul edilir; kapital balanslaşdırıcı rəqəm kimi hesablanır. Format standartlara
 * uyğundur, rəqəmlər mövcud əməliyyat datasından hesablanır.
 */

export interface StmtLine {
  label: string;
  amount?: number;
  /** 0 = əsas, 1 = alt maddə */
  level?: number;
  kind?: 'header' | 'line' | 'subtotal' | 'total';
  /** IFRS istinadı, məs. "IAS 1.82(a)" */
  note?: string;
}

export interface Statement {
  id: 'income' | 'balance' | 'cashflow';
  title: string;
  standard: string;
  lines: StmtLine[];
}

export interface IfrsInput {
  /** Xalis satış gəliri (endirimdən sonra, ƏDV-siz) */
  revenue: number;
  /** Satışın maya dəyəri (COGS) */
  cogs: number;
  /** Kateqoriya üzrə əməliyyat xərcləri (açar = ExpenseCategory) */
  expensesByCategory: Record<string, number>;
  /** Ticarət debitorları (AR qalığı) */
  receivables: number;
  /** Ticarət kreditorları (AP qalığı) */
  payables: number;
  /** Xam material stok dəyəri */
  rawInventory: number;
  /** Hazır məhsul stok dəyəri */
  fgInventory: number;
  /** Pul vəsaitləri və ekvivalentləri (kassa qalıqları) */
  cash: number;
  /** Mənfəət vergisi dərəcəsi (default 20%) */
  taxRate?: number;
}

const R = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Xərc kateqoriyalarını IFRS funksional qruplara ayır */
function groupExpenses(byCat: Record<string, number>) {
  const g = (keys: string[]) => keys.reduce((a, k) => a + (byCat[k] ?? 0), 0);
  return {
    distribution: g(['marketing', 'transport', 'packaging']),
    administrative: g(['salary', 'rent', 'utilities', 'taxes', 'other']),
    otherOperating: g(['raw_material', 'production', 'washing']),
    finance: g(['bank_fees']),
  };
}

export interface IfrsResult {
  income: Statement;
  balance: Statement;
  cashflow: Statement;
  /** Əsas göstəricilər (KPI zolağı üçün) */
  kpis: {
    revenue: number; grossProfit: number; grossMargin: number;
    operatingProfit: number; profitBeforeTax: number; incomeTax: number;
    netProfit: number; netMargin: number; totalAssets: number; totalEquity: number;
  };
}

export function buildIfrs(input: IfrsInput): IfrsResult {
  const taxRate = input.taxRate ?? 20;
  const { revenue, cogs, receivables, payables, cash } = input;
  const inventory = R(input.rawInventory + input.fgInventory);
  const exp = groupExpenses(input.expensesByCategory);

  const grossProfit = R(revenue - cogs);
  const operatingProfit = R(grossProfit - exp.distribution - exp.administrative - exp.otherOperating);
  const profitBeforeTax = R(operatingProfit - exp.finance);
  const incomeTax = R(Math.max(0, profitBeforeTax) * (taxRate / 100));
  const netProfit = R(profitBeforeTax - incomeTax);
  const grossMargin = revenue > 0 ? R((grossProfit / revenue) * 100) : 0;
  const netMargin = revenue > 0 ? R((netProfit / revenue) * 100) : 0;

  // ── Mənfəət və Zərər haqqında Hesabat (IAS 1) ──
  const income: Statement = {
    id: 'income',
    title: 'Mənfəət və Zərər haqqında Hesabat',
    standard: 'IAS 1 — Statement of Profit or Loss',
    lines: [
      { label: 'Gəlir (satışdan, net)', amount: R(revenue), kind: 'line', note: 'IFRS 15' },
      { label: 'Satışın maya dəyəri', amount: R(-cogs), kind: 'line' },
      { label: 'Ümumi mənfəət', amount: grossProfit, kind: 'subtotal' },
      { label: 'Paylama (satış) xərcləri', amount: R(-exp.distribution), kind: 'line', level: 1 },
      { label: 'İnzibati xərclər', amount: R(-exp.administrative), kind: 'line', level: 1 },
      { label: 'Digər əməliyyat xərcləri', amount: R(-exp.otherOperating), kind: 'line', level: 1 },
      { label: 'Əməliyyat mənfəəti (EBIT)', amount: operatingProfit, kind: 'subtotal' },
      { label: 'Maliyyə xərcləri', amount: R(-exp.finance), kind: 'line', level: 1 },
      { label: 'Vergidən əvvəlki mənfəət', amount: profitBeforeTax, kind: 'subtotal' },
      { label: `Mənfəət vergisi (${taxRate}%)`, amount: R(-incomeTax), kind: 'line', level: 1 },
      { label: 'Dövrün xalis mənfəəti', amount: netProfit, kind: 'total' },
    ],
  };

  // ── Maliyyə Vəziyyəti haqqında Hesabat / Balans (IAS 1) ──
  const totalCurrentAssets = R(inventory + receivables + cash);
  const nonCurrentAssets = 0;
  const totalAssets = R(nonCurrentAssets + totalCurrentAssets);
  const taxPayable = incomeTax;
  const totalCurrentLiabilities = R(payables + taxPayable);
  const totalEquity = R(totalAssets - totalCurrentLiabilities);
  const otherEquity = R(totalEquity - netProfit);

  const balance: Statement = {
    id: 'balance',
    title: 'Maliyyə Vəziyyəti haqqında Hesabat (Balans)',
    standard: 'IAS 1 — Statement of Financial Position',
    lines: [
      { label: 'AKTİVLƏR', kind: 'header' },
      { label: 'Uzunmüddətli aktivlər', kind: 'line', level: 0 },
      { label: 'Əsas vəsaitlər', amount: nonCurrentAssets, kind: 'line', level: 1 },
      { label: 'Cəmi uzunmüddətli aktivlər', amount: nonCurrentAssets, kind: 'subtotal' },
      { label: 'Qısamüddətli aktivlər', kind: 'line', level: 0 },
      { label: 'Ehtiyatlar (material + hazır məhsul)', amount: inventory, kind: 'line', level: 1, note: 'IAS 2' },
      { label: 'Ticarət debitorları', amount: R(receivables), kind: 'line', level: 1 },
      { label: 'Pul vəsaitləri və ekvivalentləri', amount: R(cash), kind: 'line', level: 1 },
      { label: 'Cəmi qısamüddətli aktivlər', amount: totalCurrentAssets, kind: 'subtotal' },
      { label: 'CƏMİ AKTİVLƏR', amount: totalAssets, kind: 'total' },
      { label: 'KAPİTAL VƏ ÖHDƏLİKLƏR', kind: 'header' },
      { label: 'Kapital', kind: 'line', level: 0 },
      { label: 'Nizamnamə və digər kapital', amount: otherEquity, kind: 'line', level: 1 },
      { label: 'Bölüşdürülməmiş mənfəət', amount: netProfit, kind: 'line', level: 1 },
      { label: 'Cəmi kapital', amount: totalEquity, kind: 'subtotal' },
      { label: 'Qısamüddətli öhdəliklər', kind: 'line', level: 0 },
      { label: 'Ticarət kreditorları', amount: R(payables), kind: 'line', level: 1 },
      { label: 'Cari mənfəət vergisi öhdəliyi', amount: taxPayable, kind: 'line', level: 1 },
      { label: 'Cəmi qısamüddətli öhdəliklər', amount: totalCurrentLiabilities, kind: 'subtotal' },
      { label: 'CƏMİ KAPİTAL VƏ ÖHDƏLİKLƏR', amount: R(totalEquity + totalCurrentLiabilities), kind: 'total' },
    ],
  };

  // ── Pul Vəsaitlərinin Hərəkəti (IAS 7, dolayı metod) ──
  // Açılış qalıqları nil qəbul edilir; işçi kapitalındakı dəyişmə cari qalıqlardır.
  const cashFromOps = R(profitBeforeTax - inventory - receivables + payables);
  const netOperating = R(cashFromOps - incomeTax);
  const netInvesting = 0;
  const netFinancing = 0;
  const netChange = R(netOperating + netInvesting + netFinancing);
  const openingCash = R(cash - netChange);

  const cashflow: Statement = {
    id: 'cashflow',
    title: 'Pul Vəsaitlərinin Hərəkəti haqqında Hesabat',
    standard: 'IAS 7 — Statement of Cash Flows (dolayı metod)',
    lines: [
      { label: 'Əməliyyat fəaliyyəti', kind: 'header' },
      { label: 'Vergidən əvvəlki mənfəət', amount: profitBeforeTax, kind: 'line', level: 1 },
      { label: 'Ehtiyatlarda dəyişmə', amount: R(-inventory), kind: 'line', level: 1 },
      { label: 'Ticarət debitorlarında dəyişmə', amount: R(-receivables), kind: 'line', level: 1 },
      { label: 'Ticarət kreditorlarında dəyişmə', amount: R(payables), kind: 'line', level: 1 },
      { label: 'Əməliyyatdan yaranan pul vəsaiti', amount: cashFromOps, kind: 'subtotal' },
      { label: 'Ödənilmiş mənfəət vergisi', amount: R(-incomeTax), kind: 'line', level: 1 },
      { label: 'Əməliyyat fəaliyyətindən xalis pul vəsaiti', amount: netOperating, kind: 'subtotal' },
      { label: 'İnvestisiya fəaliyyətindən xalis pul vəsaiti', amount: netInvesting, kind: 'subtotal' },
      { label: 'Maliyyələşdirmə fəaliyyətindən xalis pul vəsaiti', amount: netFinancing, kind: 'subtotal' },
      { label: 'Pul vəsaitlərində xalis artım/(azalma)', amount: netChange, kind: 'total' },
      { label: 'Dövrün əvvəlinə pul vəsaitləri', amount: openingCash, kind: 'line' },
      { label: 'Dövrün sonuna pul vəsaitləri', amount: R(cash), kind: 'total' },
    ],
  };

  return {
    income, balance, cashflow,
    kpis: {
      revenue: R(revenue), grossProfit, grossMargin, operatingProfit,
      profitBeforeTax, incomeTax, netProfit, netMargin, totalAssets, totalEquity,
    },
  };
}
