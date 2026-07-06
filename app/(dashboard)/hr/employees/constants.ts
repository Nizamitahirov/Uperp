export const EMP_STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' | 'default' }> = {
  active: { label: 'Aktiv', variant: 'success' },
  probation: { label: 'Sınaq', variant: 'warning' },
  on_leave: { label: 'Məzuniyyətdə', variant: 'default' },
  suspended: { label: 'Dayandırılmış', variant: 'secondary' },
  terminated: { label: 'İşdən çıxmış', variant: 'destructive' },
};

export const CONTRACT_LABELS: Record<string, string> = { permanent: 'Daimi', fixed_term: 'Müddətli', part_time: 'Yarımştat', intern: 'Təcrübəçi' };
export const PAY_LABELS: Record<string, string> = { monthly: 'Aylıq', daily: 'Günlük', hourly: 'Saatlıq', piece_rate: 'Ədədi (piece-rate)' };
