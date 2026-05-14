const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const FILTER_SETTINGS_KEY = 'filter_settings';
const CRAWL_STATUS_KEY = 'crawl_status';
const COMMENT_SETTINGS_KEY = 'comment_settings';

type Profile = {
  user_id: string;
  email: string;
  display_name: string;
  approved: boolean;
  is_admin: boolean;
};

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const resource = url.searchParams.get('resource');

      if (resource === 'profile') {
        const auth = await authenticate(request, { requireApproved: false });
        return json({ profile: auth.profile });
      }

      const auth = await authenticate(request);
      if (resource === 'events') return json({ events: await loadEvents(auth.user.id) });
      if (resource === 'filterSettings') {
        return json({ value: await loadSetting(userSettingKey(FILTER_SETTINGS_KEY, auth.user.id)) });
      }
      if (resource === 'commentSettings') {
        return json({ value: await loadSetting(userSettingKey(COMMENT_SETTINGS_KEY, auth.user.id)) });
      }
      if (resource === 'crawlStatus') {
        return json({ value: await loadSetting(CRAWL_STATUS_KEY) });
      }
      return json({ error: 'Unknown data request.' }, 400);
    }

    if (request.method === 'POST') {
      const auth = await authenticate(request);
      const body = await request.json().catch(() => ({}));
      if (body.action === 'updateEventState') {
        await updateEventState(auth.user.id, String(body.eventId ?? ''), body.patch ?? {});
        return json({ ok: true });
      }
      if (body.action === 'saveFilterSettings') {
        await saveSetting(userSettingKey(FILTER_SETTINGS_KEY, auth.user.id), body.settings ?? {});
        return json({ ok: true });
      }
      if (body.action === 'saveCommentSettings') {
        await saveSetting(userSettingKey(COMMENT_SETTINGS_KEY, auth.user.id), normalizeCommentSettings(body.settings ?? {}));
        return json({ ok: true });
      }
      return json({ error: 'Unknown save request.' }, 400);
    }

    return json({ error: 'Only GET and POST requests are supported.' }, 405);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Data request failed.';
    return json({ error: message }, status);
  }
});

async function authenticate(
  request: Request,
  options: { requireApproved?: boolean } = {},
) {
  const token = extractBearerToken(request.headers.get('authorization') ?? '');
  if (!token) throw new HttpError('Login is required.', 401);

  const user = await loadAuthUser(token);
  const profile = await ensureProfile(user);
  if (options.requireApproved !== false && !profile.approved) {
    throw new HttpError('Account approval is required.', 403);
  }

  return { user, profile };
}

async function loadAuthUser(token: string): Promise<AuthUser> {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.id) {
    throw new HttpError('Invalid login session.', 401);
  }

  return payload as AuthUser;
}

async function ensureProfile(user: AuthUser): Promise<Profile> {
  const existing = await restFetch(
    `/rest/v1/profiles?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );
  if (Array.isArray(existing) && existing[0]) return existing[0] as Profile;

  const displayName =
    stringFromMetadata(user.user_metadata, 'full_name') ||
    stringFromMetadata(user.user_metadata, 'name') ||
    '';
  const inserted = await restFetch('/rest/v1/profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email ?? '',
      display_name: displayName,
      approved: false,
      is_admin: false,
    }),
  });

  if (Array.isArray(inserted) && inserted[0]) return inserted[0] as Profile;
  throw new Error('Could not create user profile.');
}

async function loadEvents(userId: string) {
  const [events, states] = await Promise.all([
    restFetch('/rest/v1/events?select=*&order=last_seen_at.desc&limit=240'),
    restFetch(
      `/rest/v1/user_event_states?select=*&user_id=eq.${encodeURIComponent(userId)}`,
    ),
  ]);

  const stateByEventId = new Map<string, Record<string, unknown>>();
  if (Array.isArray(states)) {
    for (const state of states) {
      if (state?.event_id) stateByEventId.set(String(state.event_id), state);
    }
  }

  if (!Array.isArray(events)) return [];
  return events.map((event) => mergeEventState(event, stateByEventId.get(String(event.id))));
}

function mergeEventState(event: Record<string, unknown>, state?: Record<string, unknown>) {
  if (!state) {
    return {
      ...event,
      status: 'ready',
      result_status: 'unknown',
      participated_at: null,
      result_checked_at: null,
      receipt_status: 'unclaimed',
      winning_memo: '',
    };
  }
  return {
    ...event,
    status: state.status,
    result_status: state.result_status,
    participated_at: state.participated_at,
    result_checked_at: state.result_checked_at,
    result_announcement_date: state.result_announcement_date ?? event.result_announcement_date,
    result_announcement_text: state.result_announcement_text || event.result_announcement_text,
    prize_title: state.prize_title || event.prize_title,
    prize_amount: state.prize_amount ?? event.prize_amount,
    receipt_status: state.receipt_status,
    winning_memo: state.winning_memo,
    memo: state.memo,
    youtube_context: state.youtube_context,
    youtube_context_saved_at: state.youtube_context_saved_at,
  };
}

async function updateEventState(
  userId: string,
  eventId: string,
  patch: Record<string, unknown>,
) {
  if (!eventId) throw new Error('Event ID is required.');
  const rowPatch = toStateRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) return;

  await restFetch('/rest/v1/user_event_states?on_conflict=user_id,event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      event_id: eventId,
      ...rowPatch,
    }),
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
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

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
    throw new Error(text || `Supabase REST failed (${response.status})`);
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
  if ('youtubeContext' in patch && isPlainObject(patch.youtubeContext)) {
    rowPatch.youtube_context = patch.youtubeContext;
    rowPatch.youtube_context_saved_at = new Date().toISOString();
  }

  return rowPatch;
}

function isPlainObject(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractBearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

function userSettingKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

function normalizeCommentSettings(settings: Record<string, unknown>) {
  return {
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey.trim() : '',
    commentPrompt: typeof settings.commentPrompt === 'string' ? settings.commentPrompt.trim() : '',
  };
}

function stringFromMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
