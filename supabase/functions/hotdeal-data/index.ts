const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

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
    if (request.method !== 'GET') {
      return json({ error: 'Only GET requests are supported.' }, 405);
    }

    await authenticate(request);
    const url = new URL(request.url);
    const limit = clampNumber(url.searchParams.get('limit'), 1, 240, 120);
    const source = cleanFilter(url.searchParams.get('source'));
    const hideSoldOut = url.searchParams.get('hideSoldOut') === '1';
    const minRecommend = clampNumber(url.searchParams.get('minRecommend'), 0, 9999, 0);
    const rows = await loadHotdeals({ limit, source, hideSoldOut, minRecommend });

    return json({ hotdeals: rows });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Hotdeal data request failed.';
    return json({ error: message }, status);
  }
});

async function authenticate(request: Request) {
  const token = extractBearerToken(request.headers.get('authorization') ?? '');
  if (!token) throw new HttpError('Login is required.', 401);

  const user = await loadAuthUser(token);
  const profile = await ensureProfile(user);
  if (!profile.approved) {
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

  const inserted = await restFetch('/rest/v1/profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      email: user.email ?? '',
      display_name: stringFromMetadata(user.user_metadata, 'full_name') || stringFromMetadata(user.user_metadata, 'name') || '',
      approved: false,
      is_admin: false,
    }),
  });

  if (Array.isArray(inserted) && inserted[0]) return inserted[0] as Profile;
  throw new Error('Could not create user profile.');
}

async function loadHotdeals(options: {
  limit: number;
  source: string;
  hideSoldOut: boolean;
  minRecommend: number;
}) {
  const params = new URLSearchParams({
    select: '*',
    order: 'last_seen_at.desc',
    limit: String(options.limit),
  });
  if (options.source) params.set('source', `eq.${options.source}`);
  if (options.hideSoldOut) {
    params.set('is_sold_out', 'eq.false');
    params.set('is_expired', 'eq.false');
  }
  if (options.minRecommend > 0) {
    params.set('recommend_count', `gte.${options.minRecommend}`);
  }
  const rows = await restFetch(`/rest/v1/eventbot_hotdeals?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
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

function extractBearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

function stringFromMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function cleanFilter(value: string | null) {
  const normalized = String(value ?? '').trim();
  return /^[a-z0-9_-]+$/i.test(normalized) ? normalized : '';
}

function clampNumber(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
