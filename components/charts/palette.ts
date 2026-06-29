/** Gradex-uyğun qrafik rəng palitrası (periwinkle əsaslı) */

// Əsas seriya rəngləri — kontrastlı, brendlə uyğun
export const CHART_COLORS = [
  '#5B5BF5', // periwinkle (primary)
  '#22C55E', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#A855F7', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
];

// Yumşaq/açıq variant (fon, sahə doldurma üçün)
export const CHART_SOFT = [
  '#5B5BF5', '#34D399', '#FBBF24', '#F87171', '#22D3EE', '#C084FC', '#F472B6', '#2DD4BF',
];

// Aging/risk üçün semantik (cari→təhlükə)
export const RISK_COLORS = ['#22C55E', '#5B5BF5', '#F59E0B', '#F97316', '#EF4444'];

export const PRIMARY = '#5B5BF5';
export const PRIMARY_SOFT = 'rgba(91,91,245,0.12)';

export function colorAt(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}
