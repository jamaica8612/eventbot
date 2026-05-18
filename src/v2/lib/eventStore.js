/* ============================================================
   v2 EventStore — localStorage 기반 사용자 액션 영속화
   - MOCK_EVENTS 전체를 저장하지 않고, 사용자가 바꾼 필드만 patch로 저장
     ({ id: { status, resultStatus, prizeTitle, prizeAmount, ... } })
   - mock seed가 코드에서 갱신되거나 항목이 추가돼도 깨지지 않음
   - merge(seeds, patches) → 화면에 보일 events 리스트
   ============================================================ */

const STORAGE_KEY = 'eventbot.v2.patches.v1';
const UI_KEY = 'eventbot.v2.ui.v1';

/* UI state (selectedView, selectedId 등) — 작은 객체 */
export function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
export function saveUiState(state) {
  try { localStorage.setItem(UI_KEY, JSON.stringify(state)); } catch {}
}

/* 사용자가 직접 추가한 이벤트들 */
const CREATED_KEY = 'eventbot.v2.created.v1';
export function loadCreated() {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
export function saveCreated(list) {
  try { localStorage.setItem(CREATED_KEY, JSON.stringify(list)); } catch {}
}

/* 저장 대상 필드 — 액션이나 ResultEntry로 사용자가 바꾸는 것들만 */
const PATCHABLE_KEYS = [
  'status', 'resultStatus', 'receiptStatus',
  'prizeTitle', 'prizeAmount', 'prizeAmountValue',
  'winningMemo', 'receivedAt', 'participatedAt',
  'youtubeContext',
];

export function loadPatches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function savePatches(patches) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
  } catch {
    // 용량 초과 등은 무시 (다음 변경 시 재시도)
  }
}

export function clearPatches() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/* 시드 + 패치 → 합쳐진 events 배열 */
export function mergeSeedsWithPatches(seeds, patches) {
  return seeds.map((seed) => {
    const patch = patches?.[seed.id];
    return patch ? { ...seed, ...patch } : seed;
  });
}

/* events 배열에서 시드와 다른 필드만 추출해 patches 객체로 변환 */
export function diffToPatches(seeds, events) {
  const seedMap = new Map(seeds.map((s) => [s.id, s]));
  const out = {};
  for (const e of events) {
    const seed = seedMap.get(e.id);
    if (!seed) continue;
    const patch = {};
    for (const k of PATCHABLE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(e, k) && !isEqual(e[k], seed[k])) {
        patch[k] = e[k];
      }
    }
    if (Object.keys(patch).length > 0) out[e.id] = patch;
  }
  return out;
}

function isEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
  }
  return false;
}
