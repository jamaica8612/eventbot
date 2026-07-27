import { describe, expect, it, vi } from 'vitest';
import {
  buildGoogleOAuthRedirectUrl,
  createDeferredAuthStateListener,
} from './supabaseAuthStorage.js';

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

describe('createDeferredAuthStateListener', () => {
  it('returns immediately and runs an async handler outside the auth callback', async () => {
    vi.useFakeTimers();
    const session = { access_token: 'test-token' };
    const handler = vi.fn(() => new Promise(() => {}));
    const deferred = createDeferredAuthStateListener(handler);

    expect(deferred.listener('SIGNED_IN', session)).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(session);
    vi.useRealTimers();
  });

  it('cancels a pending handler when the subscription is removed', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const deferred = createDeferredAuthStateListener(handler);

    deferred.listener('INITIAL_SESSION', null);
    deferred.cancel();
    await vi.runAllTimersAsync();

    expect(handler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
