export function normalizePublicConfigValue(value) {
  if (typeof value !== 'string') return '';

  let normalized = value.trim();
  const hasMatchingQuotes =
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('"') && normalized.endsWith('"'));

  if (hasMatchingQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

export const supabaseUrl = normalizePublicConfigValue(
  import.meta.env.VITE_SUPABASE_URL,
).replace(/\/+$/, '');
export const supabaseAnonKey = normalizePublicConfigValue(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
