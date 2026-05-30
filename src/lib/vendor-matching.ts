/**
 * Fuzzy vendor name matching for the expense inbox.
 *
 * - normalizeVendorName: lowercased, trimmed, punctuation/whitespace collapsed,
 *   common legal suffixes stripped.
 * - findVendorMatch: exact normalized match wins; otherwise best Levenshtein-ratio
 *   match above THRESHOLD is returned with its score.
 */

const LEGAL_SUFFIXES = [
  'ltd', 'limited', 'llc', 'l.l.c', 'inc', 'incorporated',
  'corp', 'corporation', 'co', 'company',
  'gmbh', 'ag', 'sarl', 'sas', 'sa', 'srl', 'spa',
  'plc', 'pty', 'bv', 'nv', 'oy', 'ab', 'as',
];

export function normalizeVendorName(input: string): string {
  if (!input) return '';
  let s = input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const parts = s.split(' ').filter((p) => !LEGAL_SUFFIXES.includes(p));
  return parts.join(' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export interface VendorLike {
  id: string;
  name: string;
}

export interface VendorMatch<V extends VendorLike = VendorLike> {
  vendor: V;
  score: number;
  exact: boolean;
}

const FUZZY_THRESHOLD = 0.85;

export function findVendorMatch<V extends VendorLike>(
  rawName: string | null | undefined,
  vendors: V[]
): VendorMatch<V> | null {
  const target = normalizeVendorName(rawName ?? '');
  if (!target || vendors.length === 0) return null;

  let best: VendorMatch<V> | null = null;
  for (const v of vendors) {
    const norm = normalizeVendorName(v.name);
    if (!norm) continue;
    if (norm === target) return { vendor: v, score: 1, exact: true };
    const score = ratio(norm, target);
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { vendor: v, score, exact: false };
    }
  }
  return best;
}
