const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AUTH_STORAGE_KEY = 'event-click-passcode-unlocked';

export function hasSavedAuth() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'yes';
}

export function clearSavedAuth() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function verifyPasscode(passcode) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase 인증 설정이 필요합니다.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-passcode`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ passcode }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || '비밀번호가 맞지 않습니다.');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTH_STORAGE_KEY, 'yes');
  }
}
