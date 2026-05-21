const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const FILTER_SETTINGS_KEY = 'filter_settings';
const CRAWL_STATUS_KEY = 'crawl_status';
const COMMENT_SETTINGS_KEY = 'comment_settings';
const GIFTICON_BUCKET = 'gifticon-images';

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

type UserEventState = {
  user_id: string;
  status: string;
  result_status: string;
  receipt_status: string;
  prize_amount: number | null;
};

type GifticonFamilyAccess = {
  family: Record<string, unknown>;
  member: Record<string, unknown>;
  members: Record<string, unknown>[];
  isOwner: boolean;
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
      if (resource === 'adminUsers') {
        await requireAdmin(auth.profile);
        return json({ users: await loadAdminUsers() });
      }
      if (resource === 'gifticonFamily') {
        return json({ family: await loadGifticonFamily(auth.user) });
      }
      if (resource === 'gifticons') {
        const filter = url.searchParams.get('filter') ?? 'active';
        return json({ gifticons: await loadGifticons(auth.user, filter) });
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
      if (body.action === 'updateEventDetails') {
        await updateEventDetails(String(body.eventId ?? ''), body.patch ?? {});
        return json({ ok: true });
      }
      if (body.action === 'createManualWinningEvent') {
        const created = await createManualWinningEvent(auth.user, body.event ?? {});
        return json({ event: created });
      }
      if (body.action === 'saveFilterSettings') {
        await saveSetting(userSettingKey(FILTER_SETTINGS_KEY, auth.user.id), body.settings ?? {});
        return json({ ok: true });
      }
      if (body.action === 'saveCommentSettings') {
        await saveSetting(userSettingKey(COMMENT_SETTINGS_KEY, auth.user.id), normalizeCommentSettings(body.settings ?? {}));
        return json({ ok: true });
      }
      if (body.action === 'updateProfileAccess') {
        await requireAdmin(auth.profile);
        await updateProfileAccess(String(body.userId ?? ''), body.patch ?? {});
        return json({ ok: true });
      }
      if (body.action === 'createGifticonFamily') {
        const family = await createGifticonFamily(auth.user, body.name);
        return json({ family });
      }
      if (body.action === 'addGifticonFamilyMember') {
        const family = await addGifticonFamilyMember(auth.user, body.email);
        return json({ family });
      }
      if (body.action === 'removeGifticonFamilyMember') {
        const family = await removeGifticonFamilyMember(auth.user, String(body.memberId ?? ''));
        return json({ family });
      }
      if (body.action === 'createGifticon') {
        const gifticon = await createGifticon(auth.user, body.gifticon ?? {});
        return json({ gifticon });
      }
      if (body.action === 'updateGifticon') {
        const gifticon = await updateGifticon(auth.user, String(body.gifticonId ?? ''), body.patch ?? {});
        return json({ gifticon });
      }
      if (body.action === 'markGifticonUsed') {
        const gifticon = await setGifticonUsedState(auth.user, String(body.gifticonId ?? ''), true);
        return json({ gifticon });
      }
      if (body.action === 'restoreGifticonActive') {
        const gifticon = await setGifticonUsedState(auth.user, String(body.gifticonId ?? ''), false);
        return json({ gifticon });
      }
      if (body.action === 'trashGifticon') {
        const gifticon = await trashGifticon(auth.user, String(body.gifticonId ?? ''));
        return json({ gifticon });
      }
      if (body.action === 'restoreGifticonFromTrash') {
        const gifticon = await restoreGifticonFromTrash(auth.user, String(body.gifticonId ?? ''));
        return json({ gifticon });
      }
      if (body.action === 'deleteGifticonPermanently') {
        await deleteGifticonPermanently(auth.user, String(body.gifticonId ?? ''));
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

function requireAdmin(profile: Profile) {
  if (!profile.is_admin) {
    throw new HttpError('Admin access is required.', 403);
  }
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
  const bootstrapAccess = getBootstrapAdminAccess(user.email);
  if (Array.isArray(existing) && existing[0]) {
    const profile = existing[0] as Profile;
    await attachPendingFamilyMemberships(user);
    if (bootstrapAccess.isAdmin && (!profile.approved || !profile.is_admin)) {
      const patch = {
        approved: true,
        is_admin: true,
      };
      await updateProfileAccess(profile.user_id, { approved: true, isAdmin: true });
      return { ...profile, ...patch };
    }
    return profile;
  }

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
      approved: bootstrapAccess.approved,
      is_admin: bootstrapAccess.isAdmin,
    }),
  });

  await attachPendingFamilyMemberships(user);
  if (Array.isArray(inserted) && inserted[0]) return inserted[0] as Profile;
  throw new Error('Could not create user profile.');
}

async function attachPendingFamilyMemberships(user: AuthUser) {
  const email = normalizeEmail(user.email);
  if (!email) return;
  await restFetch(`/rest/v1/gifticon_family_members?email=eq.${encodeURIComponent(email)}&user_id=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id }),
  });
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

async function updateEventDetails(eventId: string, patch: Record<string, unknown>) {
  if (!eventId) throw new Error('Event ID is required.');
  const rowPatch: Record<string, unknown> = {};

  if ('deadlineDate' in patch) rowPatch.deadline_date = patch.deadlineDate || null;
  if ('deadlineText' in patch) {
    const deadlineText = typeof patch.deadlineText === 'string' ? patch.deadlineText.trim() : '';
    rowPatch.deadline_text = deadlineText || '상세 확인 필요';
    rowPatch.due_text = rowPatch.deadline_text;
  }

  if (Object.keys(rowPatch).length === 0) return;

  await restFetch(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rowPatch),
  });
}

async function createManualWinningEvent(user: AuthUser, input: Record<string, unknown>) {
  const title = normalizeShortText(input.title, 180);
  if (!title) throw new HttpError('Title is required.', 400);

  const sourceEventId = crypto.randomUUID();
  const participatedAt =
    typeof input.participatedAt === 'string' && input.participatedAt
      ? new Date(`${input.participatedAt}T12:00:00`).toISOString()
      : new Date().toISOString();
  const resultCheckedAt =
    typeof input.resultCheckedAt === 'string' && input.resultCheckedAt
      ? new Date(`${input.resultCheckedAt}T12:00:00`).toISOString()
      : new Date().toISOString();
  const prizeTitle = normalizeShortText(input.prizeTitle, 180) || title;
  const prizeAmount = parseAmount(input.prizeAmount);
  const receiptStatus = input.receiptStatus === 'received' ? 'received' : 'unclaimed';
  const memo = normalizeShortText(input.memo, 500);
  const platform = normalizeShortText(input.platform, 60) || '수기입력';
  const sourceUrl = normalizeShortText(input.url, 500);
  const url = sourceUrl || `local://manual-winning/${sourceEventId}`;

  const insertedEvents = await restFetch('/rest/v1/events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      source_site: 'manual',
      source_name: '수기 입력',
      source_event_id: sourceEventId,
      title,
      url,
      apply_url: sourceUrl || null,
      platform,
      due_text: '수기 입력',
      deadline_text: '수기 입력',
      prize_text: prizeTitle,
      prize_title: prizeTitle,
      prize_amount: prizeAmount,
      effort: 'quick',
      status: 'ready',
      result_status: 'unknown',
      raw: {
        userCreated: true,
        manualWinning: true,
        createdBy: user.id,
      },
    }),
  });
  const event = Array.isArray(insertedEvents) ? insertedEvents[0] : null;
  if (!event?.id) throw new Error('Could not create manual winning event.');

  const insertedStates = await restFetch('/rest/v1/user_event_states?on_conflict=user_id,event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      event_id: event.id,
      status: 'done',
      result_status: 'won',
      participated_at: participatedAt,
      result_checked_at: resultCheckedAt,
      prize_title: prizeTitle,
      prize_amount: prizeAmount,
      receipt_status: receiptStatus,
      winning_memo: memo,
      memo,
    }),
  });
  const state = Array.isArray(insertedStates) ? insertedStates[0] : null;
  return mergeEventState(event, state);
}

async function loadGifticonFamily(user: AuthUser) {
  const access = await findGifticonFamilyAccess(user);
  return access ? formatGifticonFamily(access, user.id) : null;
}

async function createGifticonFamily(user: AuthUser, rawName: unknown) {
  const existing = await findGifticonFamilyAccess(user);
  if (existing) return formatGifticonFamily(existing, user.id);

  const name =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 80) : '우리 가족 기프티콘';
  const insertedFamily = await restFetch('/rest/v1/gifticon_families', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, owner_user_id: user.id }),
  });
  const family = Array.isArray(insertedFamily) ? insertedFamily[0] : null;
  if (!family?.id) throw new Error('Could not create gifticon family.');

  await restFetch('/rest/v1/gifticon_family_members?on_conflict=family_id,email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      family_id: family.id,
      user_id: user.id,
      email: normalizeEmail(user.email),
      role: 'owner',
    }),
  });

  const access = await findGifticonFamilyAccess(user);
  if (!access) throw new Error('Could not load gifticon family.');
  return formatGifticonFamily(access, user.id);
}

async function addGifticonFamilyMember(user: AuthUser, rawEmail: unknown) {
  const access = await requireGifticonFamilyAccess(user);
  if (!access.isOwner) throw new HttpError('Only the family owner can add members.', 403);
  const email = normalizeEmail(rawEmail);
  if (!email) throw new HttpError('Member email is required.', 400);

  const profileRows = await restFetch(
    `/rest/v1/profiles?select=user_id&email=eq.${encodeURIComponent(email)}&limit=1`,
  );
  const profile = Array.isArray(profileRows) ? profileRows[0] : null;
  await restFetch('/rest/v1/gifticon_family_members?on_conflict=family_id,email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      family_id: access.family.id,
      user_id: profile?.user_id ?? null,
      email,
      role: 'member',
    }),
  });

  const nextAccess = await requireGifticonFamilyAccess(user);
  return formatGifticonFamily(nextAccess, user.id);
}

async function removeGifticonFamilyMember(user: AuthUser, memberId: string) {
  const access = await requireGifticonFamilyAccess(user);
  if (!access.isOwner) throw new HttpError('Only the family owner can remove members.', 403);
  if (!memberId) throw new HttpError('Member ID is required.', 400);
  const member = access.members.find((item) => String(item.id) === memberId);
  if (!member) throw new HttpError('Member not found.', 404);
  if (String(member.role) === 'owner') throw new HttpError('The owner cannot be removed.', 400);

  await restFetch(`/rest/v1/gifticon_family_members?id=eq.${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });

  const nextAccess = await requireGifticonFamilyAccess(user);
  return formatGifticonFamily(nextAccess, user.id);
}

async function loadGifticons(user: AuthUser, filter: string) {
  const access = await findGifticonFamilyAccess(user);
  if (!access) return [];
  const familyId = encodeURIComponent(String(access.family.id));
  const statusFilter = filter === 'used' ? '&status=eq.used&deleted_at=is.null' : '';
  const activeFilter = filter === 'active' ? '&status=eq.active&deleted_at=is.null' : '';
  const trashFilter = filter === 'trash' ? '&deleted_at=not.is.null' : '';
  const rows = await restFetch(
    `/rest/v1/gifticons?select=*&family_id=eq.${familyId}${statusFilter}${activeFilter}${trashFilter}&order=expires_at.asc.nullslast&order=created_at.desc`,
  );
  return Array.isArray(rows) ? Promise.all(rows.map((row) => formatGifticon(row, access))) : [];
}

async function createGifticon(user: AuthUser, input: Record<string, unknown>) {
  const access = await requireGifticonFamilyAccess(user);
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new HttpError('Gifticon title is required.', 400);
  if (title.length > 120) throw new HttpError('Gifticon title is too long.', 400);
  const imageDataUrl = typeof input.imageDataUrl === 'string' ? input.imageDataUrl : '';
  if (!imageDataUrl) throw new HttpError('Gifticon image is required.', 400);

  const imagePath = await uploadGifticonImage(access.family.id, imageDataUrl);
  const inserted = await restFetch('/rest/v1/gifticons', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      family_id: access.family.id,
      created_by: user.id,
      title,
      expires_at: normalizeDate(input.expiresAt),
      memo: normalizeShortText(input.memo, 500),
      barcode_value: normalizeShortText(input.barcodeValue, 160),
      image_path: imagePath,
      status: 'active',
    }),
  });
  const gifticon = Array.isArray(inserted) ? inserted[0] : null;
  if (!gifticon?.id) throw new Error('Could not create gifticon.');
  await logGifticonActivity(String(gifticon.id), user.id, 'create', null, 'active');
  return formatGifticon(gifticon, access);
}

async function updateGifticon(user: AuthUser, gifticonId: string, patch: Record<string, unknown>) {
  const { gifticon, access } = await requireGifticon(user, gifticonId);
  const rowPatch: Record<string, unknown> = {};
  if ('title' in patch) {
    const title = typeof patch.title === 'string' ? patch.title.trim() : '';
    if (!title) throw new HttpError('Gifticon title is required.', 400);
    rowPatch.title = title.slice(0, 120);
  }
  if ('expiresAt' in patch) rowPatch.expires_at = normalizeDate(patch.expiresAt);
  if ('memo' in patch) rowPatch.memo = normalizeShortText(patch.memo, 500);
  if ('barcodeValue' in patch) rowPatch.barcode_value = normalizeShortText(patch.barcodeValue, 160);
  if (Object.keys(rowPatch).length === 0) return formatGifticon(gifticon, access);

  const updated = await restFetch(`/rest/v1/gifticons?id=eq.${encodeURIComponent(gifticonId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rowPatch),
  });
  const nextGifticon = Array.isArray(updated) ? updated[0] : gifticon;
  await logGifticonActivity(gifticonId, user.id, 'update', String(gifticon.status ?? ''), String(nextGifticon.status ?? ''));
  return formatGifticon(nextGifticon, access);
}

async function setGifticonUsedState(user: AuthUser, gifticonId: string, isUsed: boolean) {
  const { gifticon, access } = await requireGifticon(user, gifticonId);
  const previousStatus = String(gifticon.status ?? 'active');
  const nextStatus = isUsed ? 'used' : 'active';
  const patch = isUsed
    ? { status: nextStatus, used_by: user.id, used_at: new Date().toISOString() }
    : { status: nextStatus, used_by: null, used_at: null };

  const updated = await restFetch(`/rest/v1/gifticons?id=eq.${encodeURIComponent(gifticonId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const nextGifticon = Array.isArray(updated) ? updated[0] : gifticon;
  await logGifticonActivity(gifticonId, user.id, isUsed ? 'mark_used' : 'restore_active', previousStatus, nextStatus);
  return formatGifticon(nextGifticon, access);
}

async function trashGifticon(user: AuthUser, gifticonId: string) {
  const { gifticon, access } = await requireGifticon(user, gifticonId);
  if (!canDeleteGifticon(user.id, gifticon, access)) {
    throw new HttpError('Only the owner or creator can delete this gifticon.', 403);
  }
  const updated = await restFetch(`/rest/v1/gifticons?id=eq.${encodeURIComponent(gifticonId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  const nextGifticon = Array.isArray(updated) ? updated[0] : gifticon;
  await logGifticonActivity(gifticonId, user.id, 'trash', String(gifticon.status ?? ''), String(gifticon.status ?? ''));
  return formatGifticon(nextGifticon, access);
}

async function restoreGifticonFromTrash(user: AuthUser, gifticonId: string) {
  const { gifticon, access } = await requireGifticon(user, gifticonId, { includeTrash: true });
  if (!access.isOwner) throw new HttpError('Only the family owner can restore trash.', 403);
  const updated = await restFetch(`/rest/v1/gifticons?id=eq.${encodeURIComponent(gifticonId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ deleted_at: null }),
  });
  const nextGifticon = Array.isArray(updated) ? updated[0] : gifticon;
  await logGifticonActivity(gifticonId, user.id, 'restore_trash', String(gifticon.status ?? ''), String(gifticon.status ?? ''));
  return formatGifticon(nextGifticon, access);
}

async function deleteGifticonPermanently(user: AuthUser, gifticonId: string) {
  const { gifticon, access } = await requireGifticon(user, gifticonId, { includeTrash: true });
  if (!access.isOwner) throw new HttpError('Only the family owner can permanently delete gifticons.', 403);
  await restFetch(`/rest/v1/gifticons?id=eq.${encodeURIComponent(gifticonId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (typeof gifticon.image_path === 'string' && gifticon.image_path) {
    await deleteGifticonImage(gifticon.image_path);
  }
}

async function requireGifticonFamilyAccess(user: AuthUser) {
  const access = await findGifticonFamilyAccess(user);
  if (!access) throw new HttpError('Gifticon family is not created.', 404);
  return access;
}

async function findGifticonFamilyAccess(user: AuthUser): Promise<GifticonFamilyAccess | null> {
  const email = normalizeEmail(user.email);
  const memberRowsByUser = await restFetch(
    `/rest/v1/gifticon_family_members?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  );
  let member = Array.isArray(memberRowsByUser) ? memberRowsByUser[0] : null;
  if (!member && email) {
    const memberRowsByEmail = await restFetch(
      `/rest/v1/gifticon_family_members?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
    );
    member = Array.isArray(memberRowsByEmail) ? memberRowsByEmail[0] : null;
    if (member && !member.user_id) {
      await restFetch(`/rest/v1/gifticon_family_members?id=eq.${encodeURIComponent(String(member.id))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: user.id }),
      });
      member = { ...member, user_id: user.id };
    }
  }
  if (!member?.family_id) return null;

  const familyRows = await restFetch(
    `/rest/v1/gifticon_families?select=*&id=eq.${encodeURIComponent(String(member.family_id))}&limit=1`,
  );
  const family = Array.isArray(familyRows) ? familyRows[0] : null;
  if (!family) return null;
  const members = await loadGifticonFamilyMembers(String(family.id));
  const isOwner = String(family.owner_user_id) === user.id || String(member.role) === 'owner';
  return { family, member, members, isOwner };
}

async function loadGifticonFamilyMembers(familyId: string) {
  const rows = await restFetch(
    `/rest/v1/gifticon_family_members?select=*&family_id=eq.${encodeURIComponent(familyId)}&order=created_at.asc`,
  );
  if (!Array.isArray(rows)) return [];
  const userIds = rows.map((row) => row.user_id).filter(Boolean).map(String);
  const profilesById = await loadProfilesById(userIds);
  return rows.map((row) => ({
    ...row,
    display_name: profilesById.get(String(row.user_id))?.display_name ?? '',
  }));
}

async function requireGifticon(
  user: AuthUser,
  gifticonId: string,
  options: { includeTrash?: boolean } = {},
) {
  if (!gifticonId) throw new HttpError('Gifticon ID is required.', 400);
  const access = await requireGifticonFamilyAccess(user);
  const rows = await restFetch(
    `/rest/v1/gifticons?select=*&id=eq.${encodeURIComponent(gifticonId)}&family_id=eq.${encodeURIComponent(String(access.family.id))}&limit=1`,
  );
  const gifticon = Array.isArray(rows) ? rows[0] : null;
  if (!gifticon) throw new HttpError('Gifticon not found.', 404);
  if (!options.includeTrash && gifticon.deleted_at) throw new HttpError('Gifticon is in trash.', 400);
  return { gifticon, access };
}

function formatGifticonFamily(access: GifticonFamilyAccess, currentUserId: string) {
  return {
    id: access.family.id,
    name: access.family.name,
    ownerUserId: access.family.owner_user_id,
    isOwner: access.isOwner,
    currentUserId,
    members: access.members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      email: member.email,
      role: member.role,
      displayName: member.display_name,
    })),
  };
}

async function formatGifticon(row: Record<string, unknown>, access: GifticonFamilyAccess) {
  const memberByUserId = new Map(
    access.members.filter((member) => member.user_id).map((member) => [String(member.user_id), member]),
  );
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    expiresAt: row.expires_at,
    memo: row.memo ?? '',
    barcodeValue: row.barcode_value ?? '',
    imagePath: row.image_path,
    imageUrl: row.image_path ? await createSignedGifticonImageUrl(String(row.image_path)) : '',
    status: row.status,
    createdBy: row.created_by,
    createdByLabel: getMemberLabel(memberByUserId.get(String(row.created_by))),
    usedBy: row.used_by,
    usedByLabel: getMemberLabel(memberByUserId.get(String(row.used_by))),
    usedAt: row.used_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    canDelete: canDeleteGifticon(String(access.member.user_id), row, access),
    canRestoreTrash: access.isOwner,
    canDeletePermanently: access.isOwner,
  };
}

function canDeleteGifticon(userId: string, gifticon: Record<string, unknown>, access: GifticonFamilyAccess) {
  return access.isOwner || String(gifticon.created_by) === userId;
}

function getMemberLabel(member?: Record<string, unknown>) {
  if (!member) return '';
  const displayName = typeof member.display_name === 'string' ? member.display_name.trim() : '';
  return displayName || String(member.email ?? '');
}

async function loadProfilesById(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const profilesById = new Map<string, Record<string, unknown>>();
  if (uniqueUserIds.length === 0) return profilesById;
  const rows = await restFetch(
    `/rest/v1/profiles?select=user_id,email,display_name&user_id=in.(${uniqueUserIds.map(encodeURIComponent).join(',')})`,
  );
  if (Array.isArray(rows)) {
    for (const row of rows) profilesById.set(String(row.user_id), row);
  }
  return profilesById;
}

async function logGifticonActivity(
  gifticonId: string,
  actorUserId: string,
  action: string,
  previousStatus: string | null,
  nextStatus: string | null,
) {
  await restFetch('/rest/v1/gifticon_activity_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      gifticon_id: gifticonId,
      actor_user_id: actorUserId,
      action,
      previous_status: previousStatus,
      next_status: nextStatus,
    }),
  });
}

async function uploadGifticonImage(familyId: unknown, imageDataUrl: string) {
  const parsed = parseDataUrl(imageDataUrl);
  const extension = extensionFromMimeType(parsed.mimeType);
  const path = `${String(familyId)}/${crypto.randomUUID()}.${extension}`;
  await storageFetch(`/storage/v1/object/${GIFTICON_BUCKET}/${path}`, {
    method: 'PUT',
    headers: {
      'content-type': parsed.mimeType,
      'cache-control': '3600',
      upsert: 'false',
    },
    body: parsed.bytes,
  });
  return path;
}

async function createSignedGifticonImageUrl(path: string) {
  const payload = await storageFetch(
    `/storage/v1/object/sign/${GIFTICON_BUCKET}/${path}`,
    {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  const signedURL = payload?.signedURL || payload?.signedUrl;
  if (!signedURL) return '';
  const supabaseUrl = requireEnv('SUPABASE_URL');
  return String(signedURL).startsWith('http') ? signedURL : `${supabaseUrl}${signedURL}`;
}

async function deleteGifticonImage(path: string) {
  await storageFetch(`/storage/v1/object/${GIFTICON_BUCKET}`, {
    method: 'DELETE',
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function storageFetch(path: string, init: RequestInit = {}) {
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
  if (!response.ok) throw new Error(text || `Supabase Storage failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!match) throw new HttpError('Invalid image data.', 400);
  const mimeType = match[1];
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) {
    throw new HttpError('Only PNG, JPG, WEBP, and GIF images are supported.', 400);
  }
  const binary = atob(match[2]);
  if (binary.length > 6 * 1024 * 1024) throw new HttpError('Image is too large.', 400);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType, bytes };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'png';
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeShortText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
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

async function loadAdminUsers() {
  const [profiles, states] = await Promise.all([
    restFetch('/rest/v1/profiles?select=*&order=created_at.desc'),
    restFetch('/rest/v1/user_event_states?select=user_id,status,result_status,receipt_status,prize_amount'),
  ]);

  const statsByUserId = new Map<string, ReturnType<typeof createEmptyUserStats>>();
  if (Array.isArray(states)) {
    for (const state of states as UserEventState[]) {
      const stats = statsByUserId.get(state.user_id) ?? createEmptyUserStats();
      stats.total += 1;
      if (state.status === 'ready') stats.ready += 1;
      if (state.status === 'later') stats.later += 1;
      if (state.status === 'done') stats.done += 1;
      if (state.status === 'skipped') stats.skipped += 1;
      if (state.result_status === 'won') stats.won += 1;
      if (state.result_status === 'lost') stats.lost += 1;
      if (state.result_status === 'unknown') stats.unknown += 1;
      if (state.result_status === 'won' && state.receipt_status !== 'received') {
        stats.unreceived += 1;
      }
      if (state.result_status === 'won' && Number.isFinite(state.prize_amount)) {
        stats.prizeAmount += Number(state.prize_amount);
      }
      statsByUserId.set(state.user_id, stats);
    }
  }

  if (!Array.isArray(profiles)) return [];
  return profiles.map((profile) => ({
    ...profile,
    stats: statsByUserId.get(String(profile.user_id)) ?? createEmptyUserStats(),
  }));
}

function createEmptyUserStats() {
  return {
    total: 0,
    ready: 0,
    later: 0,
    done: 0,
    skipped: 0,
    unknown: 0,
    won: 0,
    lost: 0,
    unreceived: 0,
    prizeAmount: 0,
  };
}

async function updateProfileAccess(userId: string, patch: Record<string, unknown>) {
  if (!userId) throw new Error('User ID is required.');
  const rowPatch: Record<string, unknown> = {};
  if (typeof patch.approved === 'boolean') rowPatch.approved = patch.approved;
  if (typeof patch.isAdmin === 'boolean') rowPatch.is_admin = patch.isAdmin;
  if (Object.keys(rowPatch).length === 0) return;

  await restFetch(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rowPatch),
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

function getBootstrapAdminAccess(email = '') {
  const normalizedEmail = email.trim().toLocaleLowerCase();
  const adminEmails = (Deno.env.get('EVENTBOT_ADMIN_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean);
  const isAdmin = Boolean(normalizedEmail && adminEmails.includes(normalizedEmail));
  return { approved: isAdmin, isAdmin };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
