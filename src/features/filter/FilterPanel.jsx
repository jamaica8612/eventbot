import { useState, useEffect } from 'react';
import { Icon, Button, IconBtn, Switch, PlatformBadge } from '../../components/index.jsx';

const INPUT_STYLE = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
};

const TA_STYLE = {
  ...INPUT_STYLE,
  minHeight: 76, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit',
};

const LBL_STYLE = { fontSize: 12, fontWeight: 650, color: 'var(--text-2)' };

function Section({ title, children, sub }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.02em', textTransform: 'uppercase', marginBottom: 11 }}>
        {title}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, marginTop: -6 }}>{sub}</div>}
      {children}
    </div>
  );
}

const PLATFORM_OPTIONS = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'naver',   label: '네이버' },
  { key: 'home',    label: '슈퍼투데이' },
];

export function FilterPanel({ settings, onChange, theme, onToggleTheme, onLock, counts, onGoExcluded, onClose }) {
  const [kw,     setKw]     = useState((settings.excludeKeywords || []).join('\n'));
  const [prompt, setPrompt] = useState(settings.commentPrompt || '');
  const [apiKey, setApiKey] = useState(settings.geminiKey || '');

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(15,18,30,.45)', backdropFilter: 'blur(2px)',
        display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn .18s',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 400, maxWidth: '100%', height: '100%',
          background: 'var(--surface)', boxShadow: 'var(--shadow-3)',
          display: 'flex', flexDirection: 'column', animation: 'slideRight .28s var(--ease-out)', overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <Icon name="filter" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>필터 설정</h3>
          <IconBtn name="x" size={32} onClick={onClose} style={{ marginLeft: 'auto' }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* 일반 */}
          <Section title="일반">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} style={{ color: 'var(--text-2)' }} />
                  {theme === 'dark' ? '다크' : '라이트'} 테마
                </span>
                <Switch on={theme === 'dark'} onChange={onToggleTheme} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="soft" icon="bookmark" onClick={onGoExcluded} style={{ flex: 1 }}>
                  제외 {counts?.excluded ?? 0}건 보기
                </Button>
                <Button variant="outline" icon="lock" onClick={onLock} style={{ flex: 1 }}>
                  잠금
                </Button>
              </div>
            </div>
          </Section>

          {/* 제외 키워드 */}
          <Section
            title="제외 키워드"
            sub="이 단어가 포함된 이벤트는 자동으로 제외됩니다. 한 줄에 하나씩."
          >
            <textarea
              value={kw}
              onChange={e => setKw(e.target.value)}
              onBlur={() => onChange({ excludeKeywords: kw.split('\n').map(s => s.trim()).filter(Boolean) })}
              placeholder={'보험\n대출\n카드발급'}
              style={TA_STYLE}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(settings.excludeKeywords || []).map(k => (
                <span key={k} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--urgent-weak)', color: 'var(--urgent-text)', fontWeight: 600 }}>
                  {k}
                </span>
              ))}
            </div>
          </Section>

          {/* 댓글 생성 설정 */}
          <Section title="댓글 생성 설정" sub="YouTube 응모 댓글 자동 생성에 사용돼요.">
            <label style={{ ...LBL_STYLE, display: 'block', marginBottom: 12 }}>
              내 Gemini API 키 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(선택)</span>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onBlur={() => onChange({ geminiKey: apiKey })}
                placeholder="AIza…"
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ ...LBL_STYLE, display: 'block' }}>
              댓글 작성 프롬프트 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(미입력 시 서버 기본)</span>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onBlur={() => onChange({ commentPrompt: prompt })}
                placeholder="예: 진솔하고 정중한 말투로, 이모지 1개 이내로 작성해줘"
                style={TA_STYLE}
              />
            </label>
          </Section>

          {/* 표시 옵션 */}
          <Section title="표시 옵션">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 550, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.hidePassed}
                onChange={e => onChange({ hidePassed: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
              />
              마감 지난 미응모 대기 숨김
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
                {counts?.passed ?? 0}건
              </span>
            </label>
            <div style={{ marginTop: 14 }}>
              <div style={{ ...LBL_STYLE, marginBottom: 8 }}>숨길 플랫폼</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {PLATFORM_OPTIONS.map(({ key, label }) => {
                  const hidden = (settings.hiddenPlatforms || []).includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => onChange({
                        hiddenPlatforms: hidden
                          ? (settings.hiddenPlatforms || []).filter(p => p !== key)
                          : [...(settings.hiddenPlatforms || []), key],
                      })}
                      style={{
                        flex: 1, padding: '9px 8px', borderRadius: 'var(--r-sm)',
                        border: '1px solid ' + (hidden ? 'var(--border)' : 'var(--accent)'),
                        background: hidden ? 'var(--surface-2)' : 'var(--accent-weak)',
                        color: hidden ? 'var(--text-3)' : 'var(--accent-text)',
                        fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      }}
                    >
                      <PlatformBadge platform={key} />
                      {hidden ? '숨김' : '표시'}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 정리 */}
          <Section title="정리">
            <div style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="trash" size={16} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>
                오래된 제외 이벤트 <b className="tnum" style={{ color: 'var(--text)' }}>{counts?.oldExcluded ?? 0}</b>개가 정리 대상이에요.
              </div>
            </div>
          </Section>
        </div>

        {/* 하단 */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', flex: 'none' }}>
          <Button
            variant="ghost" icon="undo" full
            onClick={() => {
              if (window.confirm('모든 필터 설정을 기본값으로 되돌릴까요?')) onChange({ __reset: true });
            }}
            style={{ color: 'var(--text-3)' }}
          >
            전체 기본값으로 리셋
          </Button>
        </div>
      </div>
    </div>
  );
}
