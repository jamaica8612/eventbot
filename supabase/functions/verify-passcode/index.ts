const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== 'POST') {
    return json({ error: 'POST 요청만 사용할 수 있습니다.' }, 405);
  }

  const expectedPasscode = Deno.env.get('EVENTBOT_PASSCODE');
  if (!expectedPasscode) {
    return json({ error: '비밀번호 secret이 설정되지 않았습니다.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';

  if (!constantTimeEqual(passcode, expectedPasscode)) {
    return json({ error: '비밀번호가 맞지 않습니다.' }, 401);
  }

  return json({ ok: true, token: await createToken(expectedPasscode) });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
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

async function createToken(secret: string) {
  const issuedAt = String(Date.now());
  const signature = await sign(issuedAt, secret);
  return `${issuedAt}.${signature}`;
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

function toBase64Url(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
