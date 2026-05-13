const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

type AuthUser = {
  id: string;
};

type Profile = {
  approved: boolean;
  is_admin: boolean;
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
    if (request.method !== 'POST') {
      throw new HttpError('Only POST requests are supported.', 405);
    }

    const auth = await authenticate(request);
    if (!auth.profile.approved) throw new HttpError('Account approval is required.', 403);

    await triggerGithubWorkflow();
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Crawler trigger failed.';
    return json({ error: message }, status);
  }
});

async function authenticate(request: Request) {
  const token = extractBearerToken(request.headers.get('authorization') ?? '');
  if (!token) throw new HttpError('Login is required.', 401);

  const user = await loadAuthUser(token);
  const profile = await loadProfile(user.id);
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
  if (!response.ok || !payload?.id) throw new HttpError('Invalid login session.', 401);
  return payload as AuthUser;
}

async function loadProfile(userId: string): Promise<Profile> {
  const rows = await restFetch(
    `/rest/v1/profiles?select=approved,is_admin&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) throw new HttpError('User profile is missing.', 403);
  return profile as Profile;
}

async function triggerGithubWorkflow() {
  const owner = Deno.env.get('GITHUB_OWNER') ?? 'jamaica8612';
  const repo = Deno.env.get('GITHUB_REPO') ?? 'eventbot';
  const workflow = Deno.env.get('GITHUB_CRAWL_WORKFLOW') ?? 'crawl-suto.yml';
  const branch = Deno.env.get('GITHUB_CRAWL_BRANCH') ?? 'main';
  const token = requireEnv('GITHUB_ACTIONS_TOKEN');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'eventbot-crawl-trigger',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ ref: branch }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Actions trigger failed (${response.status}): ${text.slice(0, 300)}`);
  }
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
  if (!response.ok) throw new Error(text || `Supabase REST failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

function extractBearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
