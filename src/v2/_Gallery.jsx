/* ============================================================
   당첨노트 v2 — 임시 프리미티브 갤러리 (개발 확인용)
   ※ 단계 4에서 AppV2로 교체되며 삭제될 임시 파일.
   ============================================================ */
import { useState } from 'react';
import { useTheme } from '../hooks/useEvents.js';
import { initialEvents } from '../data/events.js';
import { enrichEvent } from '../utils/eventModel.js';
import { Badge, PlatformBadge, Chip, Btn, IconBtn, SegToggle, Switch, Avatar, Empty, Spinner, Brandmark, ThemeToggleFloat } from './components/primitives.jsx';
import { toEv } from './lib/adapter.js';
import { deadlineMeta, announceMeta, wonShort, parseAmount } from './lib/domain.js';

// 어댑터 스모크 테스트 (단계 3 검증용, 단계 4에서 갤러리와 함께 제거)
const _sample = enrichEvent(initialEvents[0] || {});
const _ev = toEv(_sample);
const _adapterCheck = {
  platform: _ev.platform,
  status: _ev.status,
  result: _ev.result,
  prizeSummary: _ev.prizeSummary,
  deadline: deadlineMeta(_ev),
  announce: announceMeta(_ev),
  parseAmount_1만5000: parseAmount('1만 5000'),
  wonShort_15000: wonShort(15000),
};

const box = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 };
const h = { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', margin: '22px 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' };

export default function Gallery() {
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const [seg, setSeg] = useState('win');
  const [sw, setSw] = useState(true);
  const [chip, setChip] = useState('all');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '40px 28px 80px', position: 'relative' }}>
      <ThemeToggleFloat theme={theme} onToggle={toggleTheme} />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Brandmark size={44} />
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>v2 프리미티브 갤러리 · 테마: {theme}</div>

        <div style={h}>Badge (tone)</div>
        <div style={box}>
          {['muted', 'accent', 'warn', 'urgent', 'win', 'lose', 'info'].map(t => <Badge key={t} tone={t}>{t}</Badge>)}
          <Badge tone="urgent" icon="alert">발표일 지남</Badge>
          <Badge tone="win" icon="trophy" solid>당첨</Badge>
        </div>

        <div style={h}>PlatformBadge</div>
        <div style={box}>
          <PlatformBadge platform="youtube" /><PlatformBadge platform="naver" /><PlatformBadge platform="home" />
          <PlatformBadge platform="youtube" size="lg" /><PlatformBadge platform="etc" size="lg" />
        </div>

        <div style={h}>Chip</div>
        <div style={box}>
          {[['all', '전체'], ['pending', '결과 미확인'], ['today', '오늘발표'], ['win', '당첨']].map(([k, l]) => (
            <Chip key={k} active={chip === k} count={3} tone={k === 'today' ? 'warn' : undefined} onClick={() => setChip(k)}>{l}</Chip>
          ))}
        </div>

        <div style={h}>Btn (variant)</div>
        <div style={box}>
          {['primary', 'default', 'soft', 'win', 'urgent', 'warn', 'ghost', 'outline'].map(v => (
            <Btn key={v} variant={v} icon="check">{v}</Btn>
          ))}
        </div>

        <div style={h}>IconBtn / SegToggle / Switch / Spinner</div>
        <div style={box}>
          <IconBtn name="pencil" /><IconBtn name="ext" /><IconBtn name="undo" active />
          <SegToggle value={seg} onChange={setSeg} options={[{ v: 'win', label: '당첨', tone: 'win' }, { v: 'lose', label: '미당첨' }, { v: 'pending', label: '미확인' }]} />
          <Switch on={sw} onChange={setSw} label="라벨" />
          <Spinner />
        </div>

        <div style={h}>어댑터 스모크 테스트 (toEv / domain)</div>
        <pre style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, fontSize: 12, color: 'var(--text-2)', overflow: 'auto' }}>
          {JSON.stringify(_adapterCheck, null, 2)}
        </pre>

        <div style={h}>Avatar / Empty</div>
        <div style={box}>
          <Avatar initial="김" /><Avatar initial="관" admin size={44} />
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)' }}>
          <Empty icon="inbox" title="해당하는 항목이 없어요" sub="필터를 바꿔보세요." />
        </div>
      </div>
    </div>
  );
}
