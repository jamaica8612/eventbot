import { describe, it, expect } from 'vitest';
import { parsePrizeAmount, normalizePrizeAmountInput } from './format.js';

describe('parsePrizeAmount', () => {
  it('숫자만 있는 입력을 그대로 파싱한다', () => {
    expect(parsePrizeAmount('15000')).toBe(15000);
  });

  it('"1만 5000"의 뒤 5000을 누락하지 않고 합산한다 (회귀)', () => {
    expect(parsePrizeAmount('1만 5000')).toBe(15000);
  });

  it('공백 없는 "1만5000"도 합산한다', () => {
    expect(parsePrizeAmount('1만5000')).toBe(15000);
  });

  it('"3만"은 30000이다', () => {
    expect(parsePrizeAmount('3만')).toBe(30000);
  });

  it('"1억"은 100000000이다', () => {
    expect(parsePrizeAmount('1억')).toBe(100000000);
  });

  it('"1억 2만 3000"의 억·만·나머지를 모두 합산한다', () => {
    expect(parsePrizeAmount('1억 2만 3000')).toBe(100023000);
  });

  it('천 단위와 나머지를 합산한다 ("1만 5천")', () => {
    expect(parsePrizeAmount('1만 5천')).toBe(15000);
  });

  it('콤마와 "원" 접미사를 무시한다', () => {
    expect(parsePrizeAmount('15,000원')).toBe(15000);
  });

  it('소수 배수("1.5만")를 반올림해 처리한다', () => {
    expect(parsePrizeAmount('1.5만')).toBe(15000);
  });

  it('빈 문자열/null/undefined는 0이다', () => {
    expect(parsePrizeAmount('')).toBe(0);
    expect(parsePrizeAmount(null)).toBe(0);
    expect(parsePrizeAmount(undefined)).toBe(0);
  });

  it('숫자가 전혀 없는 문자열은 0이다', () => {
    expect(parsePrizeAmount('미정')).toBe(0);
  });

  it('이미 숫자인 입력도 처리한다', () => {
    expect(parsePrizeAmount(15000)).toBe(15000);
  });
});

describe('normalizePrizeAmountInput', () => {
  it('빈 입력은 빈 문자열을 반환한다', () => {
    expect(normalizePrizeAmountInput('')).toBe('');
    expect(normalizePrizeAmountInput(null)).toBe('');
  });

  it('합산 결과를 숫자 문자열로 반환한다', () => {
    expect(normalizePrizeAmountInput('1만 5000')).toBe('15000');
  });

  it('단위 없는 숫자 문자열을 그대로 정규화한다', () => {
    expect(normalizePrizeAmountInput('15,000원')).toBe('15000');
  });

  it('숫자가 없으면 빈 문자열을 반환한다', () => {
    expect(normalizePrizeAmountInput('미정')).toBe('');
  });
});
