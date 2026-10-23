/**
 * Standard-mode calculator with immediate execution (no algebraic precedence).
 *
 * Precision policy: values are BigInt-backed decimals (see decimal.ts).
 * Add/subtract/multiply are exact, divide and square root keep 40 significant
 * digits, and the display rounds to 16 significant digits, switching to
 * exponential notation outside that range. Typed entry is limited to 16 digits.
 */
import {
  ZERO,
  add,
  div,
  formatDecimal,
  isNegative,
  isOverflow,
  isZero,
  mul,
  negate,
  parseDecimal,
  sqrt,
  sub,
  type Decimal,
} from './decimal';

export type CalcOp = '+' | '-' | '*' | '/';

export interface CalcState {
  /** Text of the current value, without the trailing display period. */
  display: string;
  /** Digits typed now append to the display. */
  entering: boolean;
  /** The display holds a right operand supplied since the last operator. */
  operandReady: boolean;
  accumulator: Decimal | null;
  pendingOp: CalcOp | null;
  lastOp: CalcOp | null;
  lastOperand: Decimal | null;
  memory: Decimal;
  error: string | null;
}

export type CalcAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; op: CalcOp }
  | { type: 'equals' }
  | { type: 'percent' }
  | { type: 'sqrt' }
  | { type: 'reciprocal' }
  | { type: 'sign' }
  | { type: 'backspace' }
  | { type: 'clearEntry' }
  | { type: 'clear' }
  | { type: 'memoryClear' }
  | { type: 'memoryRecall' }
  | { type: 'memoryStore' }
  | { type: 'memoryAdd' };

export const MAX_DIGITS = 16;
export const DIVIDE_BY_ZERO = 'Cannot divide by zero.';
export const INVALID_INPUT = 'Invalid input for function.';
export const OVERFLOW = 'Overflow.';

export const initialCalc: CalcState = {
  display: '0',
  entering: false,
  operandReady: false,
  accumulator: null,
  pendingOp: null,
  lastOp: null,
  lastOperand: null,
  memory: ZERO,
  error: null,
};

const HUNDRED = parseDecimal('100')!;
const ONE = parseDecimal('1')!;

const valueOf = (s: CalcState): Decimal => parseDecimal(s.display) ?? ZERO;

function apply(left: Decimal, op: CalcOp, right: Decimal): Decimal | string {
  switch (op) {
    case '+':
      return add(left, right);
    case '-':
      return sub(left, right);
    case '*':
      return mul(left, right);
    case '/':
      return div(left, right) ?? DIVIDE_BY_ZERO;
  }
}

function withResult(s: CalcState, result: Decimal | string, patch: Partial<CalcState>): CalcState {
  if (typeof result === 'string' || isOverflow(result)) {
    return { ...initialCalc, memory: s.memory, error: typeof result === 'string' ? result : OVERFLOW };
  }
  return { ...s, ...patch, display: formatDecimal(result) };
}

function digitCount(display: string): number {
  return display.replace(/[-.]/g, '').length;
}

export function calcReduce(s: CalcState, action: CalcAction): CalcState {
  if (s.error) {
    if (action.type === 'clear' || action.type === 'clearEntry') return { ...initialCalc, memory: s.memory };
    return s;
  }
  switch (action.type) {
    case 'digit': {
      if (!/^[0-9]$/.test(action.digit)) return s;
      if (!s.entering) return { ...s, display: action.digit, entering: true, operandReady: true };
      if (digitCount(s.display) >= MAX_DIGITS) return s;
      if (s.display === '0') return { ...s, display: action.digit };
      if (s.display === '-0') return { ...s, display: `-${action.digit}` };
      return { ...s, display: s.display + action.digit };
    }
    case 'decimal': {
      if (!s.entering) return { ...s, display: '0.', entering: true, operandReady: true };
      if (s.display.includes('.')) return s;
      return { ...s, display: `${s.display}.` };
    }
    case 'backspace': {
      if (!s.entering) return s;
      const next = s.display.slice(0, -1);
      return { ...s, display: next === '' || next === '-' ? '0' : next };
    }
    case 'clearEntry':
      return { ...s, display: '0', entering: false, operandReady: s.pendingOp !== null };
    case 'clear':
      return { ...initialCalc, memory: s.memory };
    case 'sign': {
      if (s.entering) {
        if (s.display === '0') return s;
        return { ...s, display: s.display.startsWith('-') ? s.display.slice(1) : `-${s.display}` };
      }
      return withResult(s, negate(valueOf(s)), { operandReady: s.pendingOp !== null || s.operandReady });
    }
    case 'operator': {
      const value = valueOf(s);
      if (s.pendingOp && s.operandReady && s.accumulator !== null) {
        const result = apply(s.accumulator, s.pendingOp, value);
        if (typeof result === 'string') return withResult(s, result, {});
        return withResult(s, result, { accumulator: result, pendingOp: action.op, entering: false, operandReady: false });
      }
      if (s.pendingOp) return { ...s, pendingOp: action.op, entering: false };
      return { ...s, accumulator: value, pendingOp: action.op, entering: false, operandReady: false };
    }
    case 'equals': {
      const value = valueOf(s);
      if (s.pendingOp && s.accumulator !== null) {
        const result = apply(s.accumulator, s.pendingOp, value);
        if (typeof result === 'string') return withResult(s, result, {});
        return withResult(s, result, {
          accumulator: result,
          lastOp: s.pendingOp,
          lastOperand: value,
          pendingOp: null,
          entering: false,
          operandReady: false,
        });
      }
      if (s.lastOp && s.lastOperand !== null) {
        const result = apply(value, s.lastOp, s.lastOperand);
        if (typeof result === 'string') return withResult(s, result, {});
        return withResult(s, result, { accumulator: result, entering: false, operandReady: false });
      }
      return { ...s, entering: false };
    }
    case 'percent': {
      const value = valueOf(s);
      let result: Decimal = ZERO;
      if (s.pendingOp === '+' || s.pendingOp === '-') result = div(mul(s.accumulator ?? ZERO, value), HUNDRED)!;
      else if (s.pendingOp === '*' || s.pendingOp === '/') result = div(value, HUNDRED)!;
      return withResult(s, result, { entering: false, operandReady: true });
    }
    case 'sqrt': {
      const result = sqrt(valueOf(s));
      return withResult(s, result ?? INVALID_INPUT, { entering: false, operandReady: true });
    }
    case 'reciprocal': {
      const result = div(ONE, valueOf(s));
      return withResult(s, result ?? DIVIDE_BY_ZERO, { entering: false, operandReady: true });
    }
    case 'memoryClear':
      return { ...s, memory: ZERO };
    case 'memoryRecall':
      return withResult(s, s.memory, { entering: false, operandReady: true });
    case 'memoryStore':
      return { ...s, memory: valueOf(s), entering: false };
    case 'memoryAdd': {
      const sum = add(s.memory, valueOf(s));
      if (isOverflow(sum)) return withResult(s, OVERFLOW, {});
      return { ...s, memory: sum, entering: false };
    }
  }
}

export const hasMemory = (s: CalcState): boolean => !isZero(s.memory);
export const memoryText = (s: CalcState): string => formatDecimal(s.memory);
export const isNegativeDisplay = (s: CalcState): boolean => isNegative(valueOf(s));

/** XP shows a trailing period on whole numbers ("20."). */
export function displayText(s: CalcState, digitGrouping = false): string {
  if (s.error) return s.error;
  let text = s.display;
  if (digitGrouping && !text.includes('e')) {
    const [int, frac] = text.split('.');
    const sign = int.startsWith('-') ? '-' : '';
    const grouped = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    text = sign + grouped + (frac !== undefined ? `.${frac}` : '');
  }
  return text.includes('.') || text.includes('e') ? text : `${text}.`;
}
