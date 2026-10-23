import { describe, expect, it } from 'vitest';
import { calcReduce, displayText, hasMemory, initialCalc, memoryText, type CalcAction, type CalcState } from '../../src/domain/calculator';

function press(keys: string, start: CalcState = initialCalc): CalcState {
  const map: Record<string, CalcAction> = {
    '+': { type: 'operator', op: '+' },
    '-': { type: 'operator', op: '-' },
    '*': { type: 'operator', op: '*' },
    '/': { type: 'operator', op: '/' },
    '=': { type: 'equals' },
    '%': { type: 'percent' },
    '.': { type: 'decimal' },
    C: { type: 'clear' },
    E: { type: 'clearEntry' },
    B: { type: 'backspace' },
    N: { type: 'sign' },
    R: { type: 'sqrt' },
    I: { type: 'reciprocal' },
    s: { type: 'memoryStore' },
    r: { type: 'memoryRecall' },
    c: { type: 'memoryClear' },
    p: { type: 'memoryAdd' },
  };
  let s = start;
  for (const key of keys.replace(/\s+/g, '')) {
    s = calcReduce(s, /\d/.test(key) ? { type: 'digit', digit: key } : map[key]);
  }
  return s;
}

describe('calculator (QA-13)', () => {
  it('uses immediate execution: 2+3×4= is 20', () => {
    expect(displayText(press('2+3*4='))).toBe('20.');
  });

  it('percent of the left operand for addition: 200+10%= is 220', () => {
    const afterPercent = press('200+10%');
    expect(displayText(afterPercent)).toBe('20.');
    expect(displayText(press('=', afterPercent))).toBe('220.');
  });

  it('percent as a fraction for multiplication: 50×10%= is 5', () => {
    expect(displayText(press('50*10%='))).toBe('5.');
  });

  it('shows divide-by-zero and recovers on C', () => {
    const err = press('8/0=');
    expect(displayText(err)).toBe('Cannot divide by zero.');
    expect(press('5', err)).toBe(err);
    expect(displayText(press('C', err))).toBe('0.');
  });

  it('repeats the last operation: 2+3== is 8', () => {
    expect(displayText(press('2+3='))).toBe('5.');
    expect(displayText(press('2+3=='))).toBe('8.');
  });

  it('supports memory store, recall, add and clear', () => {
    let s = press('12s');
    expect(memoryText(s)).toBe('12');
    expect(hasMemory(s)).toBe(true);
    s = press('C 3 p', s);
    expect(memoryText(s)).toBe('15');
    s = press('C r', s);
    expect(displayText(s)).toBe('15.');
    s = press('c', s);
    expect(hasMemory(s)).toBe(false);
  });

  it('handles decimals without binary artifacts', () => {
    expect(displayText(press('.1+.2='))).toBe('0.3');
    expect(displayText(press('.1+.2-.3='))).toBe('0.');
    expect(displayText(press('1/3*3='))).toBe('1.');
    expect(displayText(press('2R'))).toBe('1.414213562373095');
    expect(displayText(press('2/3='))).toBe('0.6666666666666667');
    expect(displayText(press('1/8='))).toBe('0.125');
  });

  it('supports sign, backspace, CE, sqrt and reciprocal', () => {
    expect(displayText(press('123B'))).toBe('12.');
    expect(displayText(press('5N'))).toBe('-5.');
    expect(displayText(press('9+5E4='))).toBe('13.');
    expect(displayText(press('16R'))).toBe('4.');
    expect(displayText(press('4I'))).toBe('0.25');
    expect(displayText(press('5NR'))).toBe('Invalid input for function.');
    expect(displayText(press('0I'))).toBe('Cannot divide by zero.');
  });

  it('changing operator before the right operand replaces it', () => {
    expect(displayText(press('6+*2='))).toBe('12.');
  });

  it('bounds entry length and uses exponential notation for large values', () => {
    expect(displayText(press('99999999999999999999'))).toBe('9999999999999999.');
    expect(displayText(press('9999999999999999*10='))).toBe('9.999999999999999e+16');
    expect(displayText(press('1000000000*1000000000='))).toBe('1e+18');
  });

  it('groups digits when requested', () => {
    expect(displayText(press('1234567'), true)).toBe('1,234,567.');
  });
});
