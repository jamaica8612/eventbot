import { Icon } from '../../components/Icon.jsx';
import { Button } from '../../components/Button.jsx';

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 99,
      border: '2px solid var(--border-strong)',
      borderTopColor: 'var(--accent)',
      display: 'inline-block',
      animation: 'spin .7s linear infinite',
    }} />
  );
}

function Brandmark({ size = 44 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <span style={{
        width: size, height: size,
        borderRadius: size * 0.3,
        background: 'var(--accent)',
        display: 'grid', placeItems: 'center',
        boxShadow: 'var(--shadow-2)',
        flex: 'none',
      }}>
        <Icon name="trophy" size={size * 0.5} stroke={2} style={{ color: 'var(--text-inv)' }} />
      </span>
      <span style={{ fontSize: size * 0.46, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>당첨노트</span>
    </span>
  );
}

/* stage: 'loading' | 'login' | 'pending' */
export function AuthGate({ stage, theme, onToggleTheme, onLogin, account, onSwitchAccount, error, isSubmitting }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'grid', placeItems: 'center',
      padding: 24,
      animation: 'fadeIn .3s',
    }}>
      {/* 테마 토글 */}
      <button
        onClick={onToggleTheme}
        title="테마 전환"
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: 11,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-2)',
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--shadow-1)',
          cursor: 'pointer',
        }}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      {stage === 'loading' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ animation: 'popIn .5s var(--ease-out)' }}>
            <Brandmark size={56} />
          </div>
          <div style={{ marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-3)', fontSize: 13.5 }}>
            <Spinner /> 로그인 확인 중…
          </div>
        </div>
      )}

      {stage === 'login' && (
        <div style={{ width: 'min(100%, 380px)', textAlign: 'center', animation: 'popIn .35s var(--ease-out)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Brandmark size={52} />
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 28,
            boxShadow: 'var(--shadow-2)',
          }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 750 }}>이벤트 응모를 한 곳에서</h1>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              대기부터 당첨·수령까지 관리하는 개인 대시보드.<br />
              <span style={{ color: 'var(--text-3)' }}>승인된 Google 계정으로만 사용할 수 있어요.</span>
            </p>
            {error && (
              <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 'var(--r-sm)', background: 'var(--urgent-weak)', color: 'var(--urgent-text)', fontSize: 12.5 }}>
                {error}
              </div>
            )}
            <button
              onClick={onLogin}
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '13px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14.5, fontWeight: 650,
                cursor: isSubmitting ? 'default' : 'pointer',
                opacity: isSubmitting ? .7 : 1,
                transition: 'filter .13s var(--ease)',
              }}
            >
              {isSubmitting ? <Spinner /> : <Icon name="google" size={20} />}
              {isSubmitting ? '로그인 중…' : 'Google 계정으로 로그인'}
            </button>
            <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon name="lock" size={12} /> 1인용 도구 · 외부 공유 안 됨
            </div>
          </div>
        </div>
      )}

      {stage === 'pending' && (
        <div style={{ width: 'min(100%, 400px)', textAlign: 'center', animation: 'popIn .35s var(--ease-out)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Brandmark size={48} />
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 28,
            boxShadow: 'var(--shadow-2)',
          }}>
            <div style={{
              width: 52, height: 52, margin: '0 auto 16px',
              borderRadius: 14,
              background: 'var(--warn-weak)',
              color: 'var(--warn-text)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="clock" size={26} />
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 750 }}>승인 대기 중</h1>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <b style={{ color: 'var(--text)' }}>{account}</b> 계정은<br />아직 관리자 승인 전이에요.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--text-3)' }}>승인되면 바로 이용할 수 있습니다.</p>
            <Button variant="outline" icon="undo" full onClick={onSwitchAccount}>다른 계정으로 로그인</Button>
          </div>
        </div>
      )}
    </div>
  );
}
