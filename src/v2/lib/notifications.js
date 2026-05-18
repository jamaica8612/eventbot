/* ============================================================
   v2 마감 임박 알림
   - PWA Notification API 사용
   - 권한이 granted 일 때만 동작
   - 마감 24시간 이내 (deadlineDate 기준) + status가 'ready' 또는 'later'
   - 같은 이벤트는 하루 1회만 발송 (localStorage 'eventbot.v2.notified.v1')
   ============================================================ */
import { computeDeadlineMeta, todayISO } from './deadline.js';

const NOTIFIED_KEY = 'eventbot.v2.notified.v1';

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

function loadNotified() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function saveNotified(map) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map)); } catch {}
}

function pruneOld(map, today) {
  const next = {};
  for (const [id, date] of Object.entries(map)) {
    if (date === today) next[id] = date;
  }
  return next;
}

export function notifyDueSoon(events) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!Array.isArray(events)) return;

  const today = todayISO();
  const notified = pruneOld(loadNotified(), today);
  let changed = false;

  for (const event of events) {
    if (!event || !event.id) continue;
    if (event.status !== 'ready' && event.status !== 'later') continue;
    if (!event.deadlineDate) continue;
    const meta = computeDeadlineMeta(event.deadlineDate);
    if (!meta || meta.variant === 'past') continue;
    if (meta.daysLeft == null || meta.daysLeft > 1) continue;
    if (notified[event.id] === today) continue;

    try {
      new Notification('마감 임박', {
        body: `${meta.label} · ${event.title}`,
        tag: `eventbot-deadline-${event.id}`,
        icon: '/icon.svg',
      });
      notified[event.id] = today;
      changed = true;
    } catch (err) {
      console.warn('[v2] notification failed', err);
    }
  }

  if (changed) saveNotified(notified);
}
