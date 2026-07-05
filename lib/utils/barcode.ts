/**
 * Code128-B barkod SVG generatoru (xarici asılılıqsız).
 * SKU/kod dəyərlərini skan edilə bilən barkoda çevirir.
 */

// Code128 simvol şablonları (0..106) — hər biri bar/boşluq modul enləri
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/** Verilmiş mətn üçün Code128-B barkod SVG (string) qaytarır */
export function code128Svg(
  input: string,
  opts: { height?: number; moduleWidth?: number; quietZone?: number; color?: string } = {},
): string {
  const height = opts.height ?? 56;
  const mw = opts.moduleWidth ?? 1.8;
  const quiet = opts.quietZone ?? 10;
  const color = opts.color ?? '#111';

  // Yalnız ASCII 32..126
  const text = (input || '').replace(/[^\x20-\x7E]/g, '').slice(0, 48) || ' ';
  const values: number[] = [START_B];
  for (const ch of text) values.push(ch.charCodeAt(0) - 32);

  // Checksum
  let sum = START_B;
  for (let k = 1; k < values.length; k++) sum += values[k] * k;
  const check = sum % 103;

  const symbols = [...values, check, STOP];
  const patterns = symbols.map((v) => PATTERNS[v]);

  let x = quiet * mw;
  const rects: string[] = [];
  for (const pat of patterns) {
    for (let i = 0; i < pat.length; i++) {
      const w = Number(pat[i]) * mw;
      if (i % 2 === 0) rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="${color}"/>`);
      x += w;
    }
  }
  const totalWidth = x + quiet * mw;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="${totalWidth.toFixed(2)}" height="${height}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="#fff"/>${rects.join('')}</svg>`;
}
