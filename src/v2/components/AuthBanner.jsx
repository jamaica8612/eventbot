import './AuthBanner.css';

const cx = (...c) => c.filter(Boolean).join(' ');

export function AuthBanner({ mode, isFetching, liveError, auth, onRefresh }) {
  if (!auth.hasConfig) {
    return (
      <div className="v2-authbar">
        <span className="v2-authbar__dot v2-authbar__dot--demo" />
        <span className="v2-authbar__label">데모 모드</span>
        <span>· Supabase 설정 없음 (VITE_SUPABASE_URL/KEY)</span>
      </div>
    );
  }

  const handleSignIn = async () => {
    try { await auth.signIn(); }
    catch (err) { alert(err?.message || '로그인 실패'); }
  };
  const handleSignOut = async () => {
    if (!window.confirm('로그아웃할까요? 데모 모드로 전환됩니다.')) return;
    try { await auth.signOut(); }
    catch (err) { alert(err?.message || '로그아웃 실패'); }
  };

  if (mode === 'loading') {
    return (
      <div className="v2-authbar">
        <span className="v2-authbar__dot v2-authbar__dot--loading" />
        <span>세션 확인 중…</span>
      </div>
    );
  }

  if (mode === 'demo') {
    return (
      <div className="v2-authbar">
        <span className="v2-authbar__dot v2-authbar__dot--demo" />
        <span className="v2-authbar__label">데모 모드</span>
        <span>· 시드 데이터 + 로컬 저장. 실데이터를 보려면 로그인.</span>
        <div className="v2-authbar__spacer" />
        <button type="button" className="v2-authbar__action" onClick={handleSignIn}>
          Google 로그인 →
        </button>
      </div>
    );
  }

  // live
  const email = auth.session?.user?.email || auth.session?.user?.user_metadata?.email || '';
  return (
    <div className="v2-authbar">
      <span className={cx('v2-authbar__dot', 'v2-authbar__dot--live', isFetching && 'v2-authbar__dot--loading')} />
      <span className="v2-authbar__label">실데이터</span>
      {email && <span>· {email}</span>}
      {liveError && <span className="v2-authbar__error">· {liveError}</span>}
      <div className="v2-authbar__spacer" />
      {onRefresh && (
        <button type="button" className="v2-authbar__action" onClick={onRefresh} disabled={isFetching}>
          ↻ 새로고침
        </button>
      )}
      <button type="button" className="v2-authbar__action" onClick={handleSignOut}>
        로그아웃
      </button>
    </div>
  );
}
