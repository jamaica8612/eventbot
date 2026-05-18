/* 검색어 부분일치를 굵고 노란 톤으로 강조하는 단순 컴포넌트 */
export function Highlight({ text, query }) {
  if (!text) return null;
  const q = (query || '').trim();
  if (!q) return text;
  const lower = String(text).toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < lower.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) { parts.push(text.slice(i)); break; }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={parts.length} style={{
        background: 'rgba(255, 210, 74, 0.28)',
        color: 'inherit',
        padding: '0 2px',
        borderRadius: 3,
        fontWeight: 'var(--fw-bold)',
      }}>
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    i = idx + needle.length;
  }
  return <>{parts}</>;
}
