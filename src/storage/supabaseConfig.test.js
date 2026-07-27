import { describe, expect, it } from 'vitest';
import { normalizePublicConfigValue } from './supabaseConfig.js';

describe('normalizePublicConfigValue', () => {
  it('removes whitespace and a leading BOM from deployed values', () => {
    expect(normalizePublicConfigValue('\uFEFFhttps://example.supabase.co'))
      .toBe('https://example.supabase.co');
  });

  it('removes matching quotes before trimming the enclosed value', () => {
    expect(normalizePublicConfigValue("'\uFEFFsb_publishable_example'"))
      .toBe('sb_publishable_example');
  });

  it('returns an empty string for a missing value', () => {
    expect(normalizePublicConfigValue(undefined)).toBe('');
  });

  it('keeps URL cleanup compatible with trailing slash removal', () => {
    expect(normalizePublicConfigValue("'\uFEFFhttps://example.supabase.co/'").replace(/\/+$/, ''))
      .toBe('https://example.supabase.co');
  });
});
