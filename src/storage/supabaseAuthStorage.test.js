import { describe, expect, it } from 'vitest';
import { buildGoogleOAuthRedirectUrl } from './supabaseAuthStorage.js';

describe('buildGoogleOAuthRedirectUrl', () => {
  it('keeps the public project Pages path for a normal browser origin', () => {
    expect(buildGoogleOAuthRedirectUrl('https://jamaica8612.github.io', '/eventbot/'))
      .toBe('https://jamaica8612.github.io/eventbot/');
  });

  it('falls back to the public Pages origin for an opaque webview origin', () => {
    expect(buildGoogleOAuthRedirectUrl('null', '/eventbot/'))
      .toBe('https://jamaica8612.github.io/eventbot/');
  });
});
