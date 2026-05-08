const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-eventbot-token',
};
const FILTER_SETTINGS_KEY = 'filter_settings';
const CRAWL_STATUS_KEY = 'crawl_status';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const passcodeSecret = Deno.env.get('EVENTBOT_PASSCODE');
  if (!passcodeSecret) {
    return json({ error: '비밀번호 secret이 설정되지 않았습니다.' }, 500);
  }

  const token = request.headers.get('x-eventbot-token') ?? '';
  if (!(await verifyToken(token, passcodeSecret))) {
    return json({ error: '잠금 해제가 필요합니다.' }, 401);
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const resource = url.searchParams.get('resource');
      if (resource === 'events') return json({ events: await loadEvents() });
      if (resource === 'filterSettings') {
        return json({ value: await loadSetting(FILTER_SETTINGS_KEY) });
      }
      if (resource === 'crawlStatus') {
        return json({ value: await loadSetting(CRAWL_STATUS_KEY) });
      }
      return json({ error: '알 수 없는 데이터 요청입니다.' }, 400);
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.action === 'updateEventState') {
        await updateEventState(String(body.eventId ?? ''), body.patch ?? {});
        return json({ ok: true });
      }
      if (body.action === 'saveFilterSettings') {
        await saveSetting(FILTER_SETTINGS_KEY, body.settings ?? {});
        return json({ ok: true });
      }
      return json({ error: '알 수 없는 저장 요청입니다.' }, 400);
    }

    return json({ error: 'GET 또는 POST 요청만 사용할 수 있습니다.' }, 405);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '데이터 요청에 실패했습니다.' }, 500);
  }
});

async function loadEvents() {
  return restFetch('/rest/v1/events?select=*&order=last_seen_at.desc&limit=240');
}

async function updateEventState(eventId: string, patch: Record<string, unknown>) {
  if (!eventId) throw new Error('이벤트 ID가 필요합니다.');
  const rowPatch = toStateRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) return;
  await restFetch(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rowPatch),
  });
}

async function loadSetting(key: string) {
  const rows = await restFetch(
    `/rest/v1/app_settings?select=value&key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  return Array.isArray(rows) ? rows[0]?.value ?? null : null;
}

async function saveSetting(key: string, value: unknown) {
  await restFetch('/rest/v1/app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value }),
  });
}

async function restFetch(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service 설정이 필요합니다.');
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase REST 실패 (${response.status})`);
  }
  return text ? JSON.parse(text) : null;
}

function toStateRowPatch(patch: Record<string, unknown>) {
  const rowPatch: Record<string, unknown> = {};

  if (typeof patch.status === 'string') rowPatch.status = patch.status;
  if (typeof patch.resultStatus === 'string') rowPatch.result_status = patch.resultStatus;
  if ('participatedAt' in patch) rowPatch.participated_at = patch.participatedAt;
  if ('resultCheckedAt' in patch) rowPatch.result_checked_at = patch.resultCheckedAt;
  if ('resultAnnouncementDate' in patch) {
    rowPatch.result_announcement_date = patch.resultAnnouncementDate || null;
  }
  if ('resultAnnouncementText' in patch) {
    rowPatch.result_announcement_text = patch.resultAnnouncementText ?? '';
  }
  if (typeof patch.receiptStatus === 'string') rowPatch.receipt_status = patch.receiptStatus;
  if ('prizeTitle' in patch) rowPatch.prize_title = patch.prizeTitle ?? '';
  if ('winningMemo' in patch) rowPatch.winning_memo = patch.winningMemo ?? '';
  if ('prizeAmount' in patch) {
    const parsedAmount = Number.parseInt(String(patch.prizeAmount ?? '').replace(/[^\d]/g, ''), 10);
    rowPatch.prize_amount = Number.isFinite(parsedAmount) ? parsedAmount : null;
  }

  return rowPatch;
}

async function verifyToken(token: string, secret: string) {
  const [issuedAtText, signature] = token.split('.');
  const issuedAt = Number(issuedAtText);
  if (!issuedAtText || !signature || !Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_MS) return false;
  const expectedSignature = await sign(issuedAtText, secret);
  return constantTimeEqual(signature, expectedSignature);
}

async function sign(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
