/* ============================================================
   당첨노트 v2 — 인증 게이트 (스플래시 / 구글 로그인 / 승인 대기)
   Source: prototype screens-auth.jsx. 시연 토글 제거, 실제 OAuth 배선.
   ============================================================ */
import { Icon } from '../../lib/icons.jsx';
import { Brandmark, ThemeToggleFloat, Spinner, Btn } from '../../components/primitives.jsx';

export function AuthGate({ stage, theme, onToggleTheme, onLogin, onSwitchAccount, account, error, isSubmitting }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'grid', placeItems: 'center', padding: 24, animation: 'fadeIn .3s' }}>
      <ThemeToggleFloat theme={theme} onToggle={onToggleTheme} />

      {stage === 'loading' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ animation: 'fadeUp .5s var(--ease-out)' }}><Brandmark size={56} /></div>
          <div style={{ marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-3)', fontSize: 13.5 }}>
            <Spinner /> 로그인 확인 중…
          </div>
        </div>
      )}

      {stage === 'login' && (
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', animation: 'popIn .35s var(--ease-out)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><Brandmark size={52} /></div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 28, boxShadow: 'var(--shadow-2)' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 750 }}>이벤트 응모를 한 곳에서</h1>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              대기부터 당첨·수령까지 관리하는 개인 대시보드.<br />
              <span style={{ color: 'var(--text-3)' }}>승인된 Google 계정으로만 사용할 수 있어요.</span>
            </p>
            <button onClick={onLogin} disabled={isSubmitting} className="btn-hover" style={{
              width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '13px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 14.5, fontWeight: 650,
              opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'default' : 'pointer',
            }}>
              {isSubmitting ? <Spinner /> : <Icon name="google" size={20} />} Google 계정으로 로그인
            </button>
            {error ? <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--urgent-text)' }}>{error}</p> : null}
            <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon name="lock" size={12} /> 1인용 도구 · 외부 공유 안 됨
            </div>
          </div>
        </div>
      )}

      {stage === 'pending' && (
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', animation: 'popIn .35s var(--ease-out)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><Brandmark size={48} /></div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 28, boxShadow: 'var(--shadow-2)' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 16px', borderRadius: 14, background: 'var(--warn-weak)', color: 'var(--warn-text)', display: 'grid', placeItems: 'center' }}>
              <Icon name="clock" size={26} />
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 750 }}>승인 대기 중</h1>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <b style={{ color: 'var(--text)' }}>{account || '현재 계정'}</b> 계정은<br />아직 관리자 승인 전이에요.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--text-3)' }}>승인되면 바로 이용할 수 있습니다.</p>
            <Btn variant="outline" icon="undo" full onClick={onSwitchAccount}>다른 계정으로 로그인</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
