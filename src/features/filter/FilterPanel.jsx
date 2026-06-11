import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { Button } from '../../components/Button.jsx';
import { IconBtn } from '../../components/Button.jsx';
import { Switch } from '../../components/Switch.jsx';
import { PlatformBadge } from '../../components/PlatformBadge.jsx';
import { normalizeFilterSettings, parseKeywordInput } from '../../storage/filterSettingsStorage.js';
import { normalizeCommentSettings } from '../../storage/commentSettingsStorage.js';

const inputStyle = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
};
const taStyle = { ...inputStyle, minHeight: 76, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' };
const sectionStyle = { padding: '16px 20px', borderBottom: '1px solid var(--border)' };
const sectionTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.02em', textTransform: 'uppercase', marginBottom: 11, display: 'block' };

export function FilterPanel({
  settings,
  commentSettings,
  theme,
  onToggleTheme,
  onLock,
  counts,
  onGoExcluded,
  onClose,
  onFilterChange,
  onCommentSettingsChange,
  onSaveCommentSettings,
  onReset,
}) {
  /* IME-safe 상태 */
  const [kwDraft, setKwDraft] = useState((settings.excludedKeywords || []).join('\n'));
  const [promptDraft, setPromptDraft] = useState(commentSettings?.commentPrompt || '');
  const [apiKeyDraft, setApiKeyDraft] = useState(commentSettings?.geminiApiKey || '');
  const isComposingKw = useRef(false);
  const isComposingPrompt = useRef(false);

  /* Esc 닫기 */
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* 외부 변경 동기화 (다른 탭) */
  useEffect(() => {
    if (!isComposingKw.current) setKwDraft((settings.excludedKeywords || []).join('\n'));
  }, [settings.excludedKeywords]);

  function saveKw(value) {
    onFilterChange && onFilterChange({ excludedKeywords: parseKeywordInput(value) });
  }

  function Section({ title, sub, children }) {
    return (
      <div style={sectionStyle}>
        <span style={sectionTitle}>{title}</span>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, marginTop: -6 }}>{sub}</div>}
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,18,30,.45)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn .18s' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 400, maxWidth: '100vw', height: '100%',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideRight .28s var(--ease-out)',
          border: 'none', borderLeft: '1px solid var(--border)',
        }}
      >
        {/* header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <Icon name="filter" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>필터 설정</h3>
          <IconBtn name="x" size={32} onClick={onClose} style={{ marginLeft: 'auto' }} />
        </div>

        {/* body */}
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
                  제외 {counts?.skipped || 0}건 보기
                </Button>
                <Button variant="outline" icon="lock" onClick={onLock} style={{ flex: 1 }}>
                  잠금
                </Button>
              </div>
            </div>
          </Section>

          {/* 제외 키워드 */}
          <Section title="제외 키워드" sub="이 단어가 포함된 이벤트는 자동으로 제외됩니다. 한 줄에 하나씩.">
            <textarea
              value={kwDraft}
              onChange={e => {
                setKwDraft(e.target.value);
                if (!e.nativeEvent.isComposing && !isComposingKw.current) saveKw(e.target.value);
              }}
              onCompositionStart={() => { isComposingKw.current = true; }}
              onCompositionEnd={e => { isComposingKw.current = false; setKwDraft(e.currentTarget.value); saveKw(e.currentTarget.value); }}
              onBlur={e => saveKw(e.currentTarget.value)}
              placeholder={'보험\n대출\n카드발급'}
              style={taStyle}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(settings.excludedKeywords || []).map(k => (
                <span key={k} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--urgent-weak)', color: 'var(--urgent-text)', fontWeight: 600 }}>{k}</span>
              ))}
            </div>
          </Section>

          {/* 댓글 생성 설정 */}
          <Section title="댓글 생성 설정" sub="YouTube 응모 댓글 자동 생성에 사용돼요.">
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: 12 }}>
              내 Gemini API 키 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(선택)</span>
              <input
                type="password"
                value={apiKeyDraft}
                onChange={e => setApiKeyDraft(e.target.value)}
                onBlur={e => onCommentSettingsChange && onCommentSettingsChange(s => ({ ...s, geminiApiKey: e.target.value }))}
                placeholder="AIza…"
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)', display: 'block' }}>
              댓글 작성 프롬프트 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(미입력 시 서버 기본)</span>
              <textarea
                value={promptDraft}
                onChange={e => {
                  setPromptDraft(e.target.value);
                  if (!e.nativeEvent.isComposing && !isComposingPrompt.current) {
                    onCommentSettingsChange && onCommentSettingsChange(s => ({ ...s, commentPrompt: e.target.value }));
                  }
                }}
                onCompositionStart={() => { isComposingPrompt.current = true; }}
                onCompositionEnd={e => {
                  isComposingPrompt.current = false;
                  const v = e.currentTarget.value;
                  setPromptDraft(v);
                  onCommentSettingsChange && onCommentSettingsChange(s => ({ ...s, commentPrompt: v }));
                }}
                onBlur={e => {
                  const v = e.currentTarget.value;
                  onCommentSettingsChange && onCommentSettingsChange(s => ({ ...s, commentPrompt: v }));
                }}
                placeholder="예: 진솔하고 정중한 말투로, 이모지 1개 이내로 작성해줘"
                style={taStyle}
              />
            </label>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <Button variant="primary" size="sm" onClick={onSaveCommentSettings}>댓글 설정 저장</Button>
            </div>
          </Section>

          {/* 표시 옵션 */}
          <Section title="표시 옵션">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 550, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.hideExpiredReadyEvents !== false}
                onChange={e => onFilterChange && onFilterChange({ hideExpiredReadyEvents: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
              />
              마감 지난 미응모 대기 숨김
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{counts?.passed || 0}건</span>
            </label>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)', marginBottom: 8 }}>숨길 플랫폼</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['유튜브 이벤트', '네이버 이벤트', '홈페이지 이벤트'].map(platform => {
                  const hidden = (settings.hiddenPlatforms || []).includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => {
                        const set = new Set(settings.hiddenPlatforms || []);
                        if (set.has(platform)) set.delete(platform); else set.add(platform);
                        onFilterChange && onFilterChange({ hiddenPlatforms: [...set] });
                      }}
                      style={{
                        flex: 1, padding: '9px 8px', borderRadius: 'var(--r-sm)',
                        border: '1px solid ' + (hidden ? 'var(--border)' : 'var(--accent)'),
                        background: hidden ? 'var(--surface-2)' : 'var(--accent-weak)',
                        color: hidden ? 'var(--text-3)' : 'var(--accent-text)',
                        fontSize: 12.5, fontWeight: 650,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <PlatformBadge platform={platform} />
                      {hidden ? '숨김' : '표시'}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>

        {/* footer */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', flex: 'none' }}>
          <Button
            variant="ghost"
            icon="undo"
            full
            onClick={() => { if (window.confirm('모든 필터 설정을 기본값으로 되돌릴까요?')) onReset && onReset(); }}
            style={{ color: 'var(--text-3)' }}
          >
            전체 기본값으로 리셋
          </Button>
        </div>
      </div>
    </div>
  );
}