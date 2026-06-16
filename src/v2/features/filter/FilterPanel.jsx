/* ============================================================
   당첨노트 v2 — 필터설정 패널 (우측 드로어 / 모바일 바텀시트)
   프로토타입 screens-filter 디자인 + 현재 filterSettings/commentSettings(분리).
   숨길 플랫폼은 실제 이벤트 platform 목록 기준(현재 isHiddenByFilterSettings와 일치).
   ============================================================ */
import { useEffect, useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Btn, IconBtn, Switch } from '../../components/primitives.jsx';

const inputStyle = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', background: 'var(--surface)',
  color: 'var(--text)', outline: 'none',
};
const lbl = { fontSize: 12, fontWeight: 650, color: 'var(--text-2)' };
const ta = { ...inputStyle, minHeight: 76, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' };

function Section({ title, sub, children }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.02em', textTransform: 'uppercase', marginBottom: 11 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, marginTop: -6 }}>{sub}</div>}
      {children}
    </div>
  );
}

export function FilterPanel({
  filterSettings, commentSettings, platforms, counts,
  theme, onFilterChange, onCommentChange, onSaveComment,
  onToggleTheme, onLock, onClose, onReset, onGoExcluded,
}) {
  const [kw, setKw] = useState((filterSettings.excludedKeywords || []).join('\n'));
  const [apiKey, setApiKey] = useState(commentSettings.geminiApiKey || '');
  const [prompt, setPrompt] = useState(commentSettings.commentPrompt || '');

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const hiddenPlatforms = filterSettings.hiddenPlatforms || [];
  const togglePlatform = (p) => {
    const next = hiddenPlatforms.includes(p) ? hiddenPlatforms.filter((x) => x !== p) : [...hiddenPlatforms, p];
    onFilterChange({ hiddenPlatforms: next });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,18,30,.45)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn .18s' }}>
      <div onClick={(e) => e.stopPropagation()} className="filter-drawer" style={{
        width: 400, maxWidth: '100%', height: '100%', background: 'var(--surface)', boxShadow: 'var(--shadow-3)',
        display: 'flex', flexDirection: 'column', animation: 'slideRight .28s var(--ease-out)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <Icon name="filter" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>필터 설정</h3>
          <IconBtn name="x" size={32} onClick={onClose} style={{ marginLeft: 'auto' }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <Section title="일반">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} style={{ color: 'var(--text-2)' }} />{theme === 'dark' ? '다크' : '라이트'} 테마
                </span>
                <Switch on={theme === 'dark'} onChange={onToggleTheme} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="soft" icon="bookmark" onClick={onGoExcluded} style={{ flex: 1 }}>제외 {counts.excluded}건 보기</Btn>
                <Btn variant="outline" icon="lock" onClick={onLock} style={{ flex: 1 }}>잠금</Btn>
              </div>
            </div>
          </Section>

          <Section title="제외 키워드" sub="이 단어가 포함된 이벤트는 자동으로 제외됩니다. 한 줄에 하나씩.">
            <textarea value={kw} onChange={(e) => setKw(e.target.value)}
              onBlur={() => onFilterChange({ excludedKeywords: kw.split('\n').map((s) => s.trim()).filter(Boolean) })}
              placeholder={'보험\n대출\n카드발급'} style={ta} />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(filterSettings.excludedKeywords || []).map((k) => <span key={k} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--urgent-weak)', color: 'var(--urgent-text)', fontWeight: 600 }}>{k}</span>)}
            </div>
          </Section>

          <Section title="댓글 생성 설정" sub="YouTube 응모 댓글 자동 생성에 사용돼요.">
            <label style={{ ...lbl, display: 'block', marginBottom: 12 }}>내 Gemini API 키 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(선택)</span>
              <input type="password" value={apiKey} autoComplete="off" onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => onCommentChange({ geminiApiKey: apiKey })} placeholder="AIza…" style={inputStyle} />
            </label>
            <label style={{ ...lbl, display: 'block' }}>댓글 작성 프롬프트 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(미입력 시 서버 기본)</span>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onBlur={() => onCommentChange({ commentPrompt: prompt })} placeholder="예: 진솔하고 정중한 말투로, 이모지 1개 이내로 작성해줘" style={ta} />
            </label>
            <div style={{ marginTop: 10 }}>
              <Btn variant="soft" size="sm" icon="check" onClick={onSaveComment}>댓글 설정 저장</Btn>
            </div>
          </Section>

          <Section title="표시 옵션">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 550, cursor: 'pointer' }}>
              <input type="checkbox" checked={filterSettings.hideExpiredReadyEvents !== false}
                onChange={(e) => onFilterChange({ hideExpiredReadyEvents: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
              마감 지난 미응모 대기 숨김
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{counts.passed}건</span>
            </label>
            {platforms.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...lbl, marginBottom: 8 }}>숨길 플랫폼</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {platforms.map((p) => {
                    const hidden = hiddenPlatforms.includes(p);
                    return (
                      <button key={p} onClick={() => togglePlatform(p)} style={{
                        padding: '8px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                        border: '1px solid ' + (hidden ? 'var(--border)' : 'var(--accent)'),
                        background: hidden ? 'var(--surface-2)' : 'var(--accent-weak)',
                        color: hidden ? 'var(--text-3)' : 'var(--accent-text)', fontSize: 12.5, fontWeight: 650,
                      }}>{hidden ? '🚫 ' : ''}{p}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>

          <Section title="정리">
            <div style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="trash" size={16} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>오래된 제외 이벤트 <b className="tnum" style={{ color: 'var(--text)' }}>{counts.oldExcluded}</b>개가 정리 대상이에요.</div>
            </div>
          </Section>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', flex: 'none' }}>
          <Btn variant="ghost" icon="undo" full onClick={() => { if (window.confirm('모든 필터 설정을 기본값으로 되돌릴까요?')) onReset(); }} style={{ color: 'var(--text-3)' }}>전체 기본값으로 리셋</Btn>
        </div>
      </div>
    </div>
  );
}
