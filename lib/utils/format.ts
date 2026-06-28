import { format } from 'date-fns';

/** Məbləği AZN formatında göstər (14.6 baseCurrency: AZN) */
export function formatCurrency(value: number, currency = 'AZN'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('az-AZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('az-AZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(date: Date | number | undefined | null, pattern = 'dd.MM.yyyy'): string {
  if (!date) return '—';
  try {
    return format(typeof date === 'number' ? new Date(date) : date, pattern);
  } catch {
    return '—';
  }
}

export function formatDateTime(date: Date | number | undefined | null): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm');
}
