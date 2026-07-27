import {
  hasSupabaseConfig,
  loadSupabaseBootstrap,
  loadSupabaseCommentSettings,
  loadSupabaseCrawlerStatus,
  loadSupabaseEvents,
  loadSupabaseFilterSettings,
  saveSupabaseCommentSettings,
  saveSupabaseFilterSettings,
  triggerSupabaseCrawler,
  updateSupabaseEventDetails,
  updateSupabaseEventState,
} from './supabaseEventStorage.js';

export const hasRemoteDataConfig = hasSupabaseConfig;

export function loadEventBootstrap(accessToken) {
  return loadSupabaseBootstrap(accessToken);
}

export function loadRemoteEvents() {
  return loadSupabaseEvents();
}

export function updateRemoteEventState(eventId, patch) {
  return updateSupabaseEventState(eventId, patch);
}

export function updateRemoteEventDetails(eventId, patch) {
  return updateSupabaseEventDetails(eventId, patch);
}

export function loadRemoteFilterSettings() {
  return loadSupabaseFilterSettings();
}

export function loadRemoteCommentSettings() {
  return loadSupabaseCommentSettings();
}

export function saveRemoteFilterSettings(settings) {
  return saveSupabaseFilterSettings(settings);
}

export function saveRemoteCommentSettings(settings) {
  return saveSupabaseCommentSettings(settings);
}

export function loadRemoteCrawlerStatus() {
  return loadSupabaseCrawlerStatus();
}

export function triggerRemoteCrawler() {
  return triggerSupabaseCrawler();
}
