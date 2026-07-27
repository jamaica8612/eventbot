import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig.js';

const AUTH_REQUIRED_EVENT = 'eventbot-auth-required';
const AUTH_TIMEOUT_MS = 12000;
const PROFILE_TIMEOUT_MS = 15000;
const PUBLIC_PAGES_ORIGIN = 'https://jamaica8612.github.io';

export const hasAuthConfig = Boolean(supabaseUrl && supabaseAnonKey);

let client;

export function getSupabaseClient() {
  if (!hasAuthConfig) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await withTimeout(
    supabase.auth.getSession(),
    AUTH_TIMEOUT_MS,
    'Google \uB85C\uADF8\uC778 \uC0C1\uD0DC \uD655\uC778\uC774 \uC9C0\uC5F0\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
  );
  if (error) throw error;
  return data.session ?? null;
}

export function onAuthStateChange(handler) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const deferredHandler = createDeferredAuthStateListener(handler, window);
  const { data } = supabase.auth.onAuthStateChange(deferredHandler.listener);
  return () => {
    data.subscription.unsubscribe();
    deferredHandler.cancel();
  };
}

export function createDeferredAuthStateListener(handler, timers = globalThis) {
  const pendingHandlers = new Set();
  return {
    listener(_event, session) {
      const timeoutId = timers.setTimeout(() => {
        pendingHandlers.delete(timeoutId);
        Promise.resolve()
          .then(() => handler(session))
          .catch(() => {});
      }, 0);
      pendingHandlers.add(timeoutId);
    },
    cancel() {
      pendingHandlers.forEach((timeoutId) => timers.clearTimeout(timeoutId));
      pendingHandlers.clear();
    },
  };
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase \uB85C\uADF8\uC778 \uC124\uC815\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: buildGoogleOAuthRedirectUrl(
        typeof window === 'undefined' ? '' : window.location.origin,
        import.meta.env.BASE_URL,
      ),
    },
  });
  if (error) throw error;
}

export function buildGoogleOAuthRedirectUrl(origin, baseUrl) {
  const safeOrigin =
    typeof origin === 'string' && /^https?:\/\/[^/]+$/i.test(origin)
      ? origin
      : PUBLIC_PAGES_ORIGIN;
  return new URL(baseUrl || '/', `${safeOrigin}/`).href;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getAuthToken() {
  const session = await getCurrentSession();
  return session?.access_token ?? '';
}

export function requireUnlock() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
}

export function onAuthRequired(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_REQUIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handler);
}

export async function loadAuthProfile(accessToken) {
  if (!hasAuthConfig) return null;
  const token = accessToken ?? (await getAuthToken());
  if (!token) return null;
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), PROFILE_TIMEOUT_MS);
  const response = await fetch(`${supabaseUrl}/functions/v1/eventbot-data?resource=profile`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${token}`,
    },
    signal: abortController.signal,
  });
  try {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload.error || '\uC0AC\uC6A9\uC790 \uC2B9\uC778 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
      );
    }
    return payload.profile ?? null;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('\uC0AC\uC6A9\uC790 \uC2B9\uC778 \uD655\uC778\uC774 \uC9C0\uC5F0\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}
