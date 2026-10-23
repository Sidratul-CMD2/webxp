/**
 * Minimal arbitrary-precision decimal: value = m × 10^e with a BigInt mantissa.
 * Addition, subtraction and multiplication are exact (then bounded to
 * WORKING_DIGITS); division and square root are computed to WORKING_DIGITS.
 * Display rounds to DISPLAY_DIGITS significant digits.
 */

export const WORKING_DIGITS = 40;
export const DISPLAY_DIGITS = 16;
const MAX_EXPONENT = 9999;

export interface Decimal {
  readonly m: bigint;
  readonly e: number;
}

export const ZERO: Decimal = { m: 0n, e: 0 };

const pow10 = (n: number): bigint => 10n ** BigInt(n);
const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const digitsOf = (n: bigint): number => (n === 0n ? 1 : abs(n).toString().length);

function canonical(m: bigint, e: number): Decimal {
  if (m === 0n) return ZERO;
  while (m % 10n === 0n) {
    m /= 10n;
    e++;
  }
  return { m, e };
}

/** Round half away from zero to `sig` significant digits. */
export function roundSig(d: Decimal, sig: number): Decimal {
  const n = digitsOf(d.m);
  if (n <= sig) return canonical(d.m, d.e);
  const drop = n - sig;
  const divisor = pow10(drop);
  let q = d.m / divisor;
  const r = abs(d.m % divisor);
  if (r * 2n >= divisor) q += d.m < 0n ? -1n : 1n;
  return canonical(q, d.e + drop);
}

const bound = (d: Decimal) => roundSig(d, WORKING_DIGITS);

export function parseDecimal(text: string): Decimal | null {
  const match = /^(-)?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text.trim());
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) return null;
  const [, sign, int, frac = '', exp = '0'] = match;
  const m = BigInt((int || '0') + frac) * (sign ? -1n : 1n);
  return bound(canonical(m, Number(exp) - frac.length));
}

export function fromNumber(n: number): Decimal {
  return parseDecimal(String(n)) ?? ZERO;
}

export const isZero = (d: Decimal) => d.m === 0n;
export const isNegative = (d: Decimal) => d.m < 0n;
export const negate = (d: Decimal): Decimal => ({ m: -d.m, e: d.e });

function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const e = Math.min(a.e, b.e);
  return [a.m * pow10(a.e - e), b.m * pow10(b.e - e), e];
}

export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, e] = align(a, b);
  return bound(canonical(x + y, e));
}

export const sub = (a: Decimal, b: Decimal): Decimal => add(a, negate(b));

export function mul(a: Decimal, b: Decimal): Decimal {
  return bound(canonical(a.m * b.m, a.e + b.e));
}

/** Returns null when dividing by zero. */
export function div(a: Decimal, b: Decimal): Decimal | null {
  if (isZero(b)) return null;
  if (isZero(a)) return ZERO;
  const k = Math.max(0, WORKING_DIGITS + 2 + digitsOf(b.m) - digitsOf(a.m));
  return bound(canonical((a.m * pow10(k)) / b.m, a.e - b.e - k));
}

/** Returns null for negative input. */
export function sqrt(a: Decimal): Decimal | null {
  if (isNegative(a)) return null;
  if (isZero(a)) return ZERO;
  let m = a.m;
  let e = a.e;
  if (e % 2 !== 0) {
    m *= 10n;
    e -= 1;
  }
  const extra = WORKING_DIGITS + 2;
  m *= pow10(extra * 2);
  e -= extra * 2;
  let x = pow10(Math.ceil(digitsOf(m) / 2));
  for (;;) {
    const y = (x + m / x) / 2n;
    if (y >= x) break;
    x = y;
  }
  return bound(canonical(x, e / 2));
}

/** Decimal exponent of the leading digit. */
const magnitude = (d: Decimal) => digitsOf(d.m) - 1 + d.e;

export function isOverflow(d: Decimal): boolean {
  return !isZero(d) && Math.abs(magnitude(d)) > MAX_EXPONENT;
}

/** Plain notation within 16 digits; exponential beyond (e.g. 1e+17). */
export function formatDecimal(value: Decimal, sig = DISPLAY_DIGITS): string {
  const d = roundSig(value, sig);
  if (isZero(d)) return '0';
  const sign = d.m < 0n ? '-' : '';
  const digits = abs(d.m).toString();
  const exp = magnitude(d);
  if (exp >= sig || exp < -(sig - 1)) {
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${mantissa}e${exp >= 0 ? '+' : '-'}${Math.abs(exp)}`;
  }
  if (d.e >= 0) return sign + digits + '0'.repeat(d.e);
  const point = digits.length + d.e;
  if (point > 0) return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  return `${sign}0.${'0'.repeat(-point)}${digits}`;
}

export function equals(a: Decimal, b: Decimal): boolean {
  const x = canonical(a.m, a.e);
  const y = canonical(b.m, b.e);
  return x.m === y.m && x.e === y.e;
}
