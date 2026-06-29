/** AR/AP aging — vaxtı keçmiş qalıqların yaş qruplarına bölünməsi (11.4) */

export interface AgingRow {
  id: string;
  name: string;
  reference?: string;
  balance: number;
  dueDate: number | null;
  daysOverdue: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+' | 'current';
}

export interface AgingSummary {
  rows: AgingRow[];
  buckets: { name: string; value: number }[];
  total: number;
  overdueTotal: number;
}

interface AgingInput {
  id: string;
  name: string;
  reference?: string;
  balance: number;
  dueDate?: { toMillis?: () => number } | null;
}

const toMillis = (ts: AgingInput['dueDate']) => ts?.toMillis?.() ?? null;

export function buildAging(items: AgingInput[], now = Date.now()): AgingSummary {
  const rows: AgingRow[] = items
    .filter((i) => (i.balance ?? 0) > 0.005)
    .map((i) => {
      const due = toMillis(i.dueDate);
      const daysOverdue = due ? Math.floor((now - due) / 86_400_000) : 0;
      let bucket: AgingRow['bucket'] = 'current';
      if (daysOverdue > 90) bucket = '90+';
      else if (daysOverdue > 60) bucket = '61-90';
      else if (daysOverdue > 30) bucket = '31-60';
      else if (daysOverdue > 0) bucket = '0-30';
      return { id: i.id, name: i.name, reference: i.reference, balance: i.balance, dueDate: due, daysOverdue, bucket };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const sumBy = (b: AgingRow['bucket']) => rows.filter((r) => r.bucket === b).reduce((a, r) => a + r.balance, 0);
  const buckets = [
    { name: 'Cari', value: sumBy('current') },
    { name: '1-30 gün', value: sumBy('0-30') },
    { name: '31-60 gün', value: sumBy('31-60') },
    { name: '61-90 gün', value: sumBy('61-90') },
    { name: '90+ gün', value: sumBy('90+') },
  ];
  const total = rows.reduce((a, r) => a + r.balance, 0);
  const overdueTotal = rows.filter((r) => r.daysOverdue > 0).reduce((a, r) => a + r.balance, 0);
  return { rows, buckets, total, overdueTotal };
}
