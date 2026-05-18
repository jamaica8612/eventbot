import './shell.css';
import { useEffect, useRef } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

const SWIPE_THRESHOLD_X = 70;
const SWIPE_THRESHOLD_Y = 90;
const SWIPE_MAX_MS = 600;

export function AppShell({
  nav, list, detail, bottomNav,
  sheet, onSheetClose, onSheetPrev, onSheetNext,
  drawerOpen, onDrawerClose,
}) {
  const touchRef = useRef(null);

  const handleTouchStart = (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now(), target: e.target };
  };

  const handleTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    if (Date.now() - start.time > SWIPE_MAX_MS) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 스크롤 가능한 요소 안에서의 제스처는 무시 (textarea / overflow)
    if (start.target && start.target.closest?.('textarea, input, [data-no-swipe]')) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > SWIPE_THRESHOLD_Y) onSheetClose?.();
    } else {
      if (dx > SWIPE_THRESHOLD_X) onSheetPrev?.();
      else if (dx < -SWIPE_THRESHOLD_X) onSheetNext?.();
    }
  };

  return (
    <div className="v2 v2-shell">
      <aside className="v2-shell__nav">{nav}</aside>
      <section className="v2-shell__list">{list}</section>
      <section className="v2-shell__detail">{detail}</section>
      <nav className="v2-shell__bnav">{bottomNav}</nav>
      {sheet && (
        <>
          <div className="v2-sheet-overlay" onClick={onSheetClose} />
          <div
            className="v2-sheet"
            role="dialog"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="v2-sheet__grab" />
            {sheet}
          </div>
        </>
      )}
      {drawerOpen && (
        <>
          <div className="v2-drawer-overlay" onClick={onDrawerClose} />
          <aside className="v2-drawer" role="dialog" aria-label="네비게이션">
            {nav}
          </aside>
        </>
      )}
    </div>
  );
}

export function SideNav({ brand, sections, user }) {
  return (
    <div className="v2-nav">
      {brand && (
        <div className="v2-nav__brand">
          <span className="v2-nav__brand-mark">{brand.mark || 'E'}</span>
          <span>{brand.name}</span>
        </div>
      )}
      {sections.map((section, si) => (
        <div key={section.title || si}>
          {section.title && <div className="v2-nav__section">{section.title}</div>}
          {section.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('v2-nav__item', item.active && 'v2-nav__item--active')}
              onClick={item.onClick}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.count != null && <span className="count">{item.count}</span>}
            </button>
          ))}
        </div>
      ))}
      {user && (
        <div className="v2-nav__footer">
          <span className="v2-avatar v2-avatar--sm">{user.initial}</span>
          <div className="v2-nav__user">
            <div className="v2-nav__user-name">{user.name}</div>
            <div className="v2-nav__user-meta">{user.meta}</div>
          </div>
          {user.onReset && (
            <button
              type="button"
              onClick={user.onReset}
              className="v2-icon-btn v2-icon-btn--sm"
              title="저장된 상태 초기화"
              aria-label="저장된 상태 초기화"
            >↺</button>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({ title, sub, actions, leftIcon, children }) {
  return (
    <header className="v2-topbar">
      {leftIcon}
      {title && (
        <div>
          <h2 className="v2-topbar__title">{title}</h2>
          {sub && <div className="v2-topbar__sub">{sub}</div>}
        </div>
      )}
      {children}
      <div className="v2-topbar__spacer" />
      {actions}
    </header>
  );
}

export function ListPanel({ topBar, children }) {
  return (
    <div className="v2-list-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {topBar}
      <div className="v2-list-panel__body">{children}</div>
    </div>
  );
}

export function DetailPanel({ topBar, children }) {
  return (
    <div className="v2-detail-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {topBar}
      <div className="v2-detail-panel__body">{children}</div>
    </div>
  );
}

export function BottomNav({ items, fab }) {
  return (
    <>
      {items.map((item, i) => {
        if (i === 2 && fab) {
          return (
            <button key="fab" type="button" className="v2-bnav__fab" onClick={fab.onClick} aria-label={fab.label}>
              {fab.icon}
            </button>
          );
        }
        if (!item) return null;
        return (
          <button
            key={item.id}
            type="button"
            className={cx('v2-bnav__item', item.active && 'v2-bnav__item--active')}
            onClick={item.onClick}
          >
            {item.dot && <span className="dot" />}
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </>
  );
}

export function Placeholder({ name, hint }) {
  return (
    <div className="v2-placeholder">
      <div>
        <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--c-text-mid)' }}>{name}</div>
        {hint && <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)' }}>{hint}</div>}
      </div>
    </div>
  );
}

export function useEscape(onEscape) {
  useEffect(() => {
    if (!onEscape) return;
    const handler = (e) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}
