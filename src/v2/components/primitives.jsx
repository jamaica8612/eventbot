/* ============================================================
   당첨노트 v2 — 공통 UI 프리미티브
   Source: prototype components.jsx + screens-inbox(SegToggle) + screens-auth(Brandmark)
   인라인 style + CSS 변수 토큰. hex 없음(고정 흰색은 --on-color, 구글 로고만 브랜드 예외).
   ============================================================ */
import { useEffect } from 'react';
import { Icon } from '../lib/icons.jsx';
import { platformMeta } from '../lib/domain.js';

/* ---------------- Badge / Chip / Pill ---------------- */
export const TONE = {
  muted: { fg: 'var(--text-2)', bg: 'var(--surface-3)' },
  accent: { fg: 'var(--accent-text)', bg: 'var(--accent-weak)' },
  warn: { fg: 'var(--warn-text)', bg: 'var(--warn-weak)' },
  urgent: { fg: 'var(--urgent-text)', bg: 'var(--urgent-weak)' },
  win: { fg: 'var(--win-text)', bg: 'var(--win-weak)' },
  lose: { fg: 'var(--text-2)', bg: 'var(--lose-weak)' },
  info: { fg: 'var(--info)', bg: 'var(--info-weak)' },
};

export function Badge({ tone = 'muted', children, icon, solid, style }) {
  const t = TONE[tone] || TONE.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 650,
      lineHeight: 1.3, whiteSpace: 'nowrap',
      color: solid ? 'var(--on-color)' : t.fg,
      background: solid ? t.fg : t.bg,
      ...style,
    }}>
      {icon && <Icon name={icon} size={12} stroke={2.2} />}
      {children}
    </span>
  );
}

export function PlatformBadge({ platform, size = 'sm' }) {
  const m = platformMeta(platform);
  const dim = size === 'lg' ? 26 : 20;
  return (
    <span title={m.label} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: dim, height: dim, borderRadius: size === 'lg' ? 8 : 6,
      background: m.weak, color: m.c, fontWeight: 800,
      fontSize: size === 'lg' ? 13 : 11, flex: 'none',
    }}>{m.short}</span>
  );
}

export function Chip({ active, onClick, children, count, tone, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
      background: active ? (tone === 'urgent' ? 'var(--urgent)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)') : 'var(--surface)',
      color: active ? 'var(--on-color)' : 'var(--text-2)',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .4 : 1,
      transition: 'all .15s var(--ease)', whiteSpace: 'nowrap',
    }}>
      {children}
      {count != null && (
        <span className="tnum" style={{
          fontSize: 11, fontWeight: 700, padding: '0 5px', borderRadius: 99, minWidth: 16, textAlign: 'center',
          background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-3)',
          color: active ? 'var(--on-color)' : 'var(--text-3)',
        }}>{count}</span>
      )}
    </button>
  );
}

/* ---------------- Buttons ---------------- */
export function Btn({ variant = 'default', size = 'md', icon, iconRight, children, onClick, disabled, full, tone, style, title }) {
  const sizes = { sm: '6px 11px', md: '9px 15px', lg: '12px 20px' };
  const fs = { sm: 13, md: 13.5, lg: 15 };
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: sizes[size], fontSize: fs[size], fontWeight: 650, borderRadius: 'var(--r-sm)',
    border: '1px solid transparent', transition: 'all .15s var(--ease)',
    width: full ? '100%' : undefined, whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .5 : 1, ...style,
  };
  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--on-accent)' },
    default: { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-strong)' },
    ghost: { background: 'transparent', color: 'var(--text-2)' },
    soft: { background: 'var(--surface-3)', color: 'var(--text)' },
    win: { background: 'var(--win)', color: 'var(--on-color)' },
    urgent: { background: 'var(--urgent)', color: 'var(--on-color)' },
    warn: { background: 'var(--warn)', color: 'var(--on-color)' },
    outline: { background: 'transparent', color: 'var(--text)', borderColor: 'var(--border-strong)' },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} className="btn-hover"
      style={{ ...base, ...(variants[variant] || variants.default) }}>
      {icon && <Icon name={icon} size={size === 'lg' ? 17 : 15} stroke={2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} stroke={2} />}
    </button>
  );
}

export function IconBtn({ name, onClick, active, title, size = 34, tone, style }) {
  return (
    <button title={title} onClick={onClick} className="btn-hover" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 'var(--r-sm)', flex: 'none',
      border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
      background: active ? 'var(--accent-weak)' : 'var(--surface)',
      color: active ? 'var(--accent-text)' : 'var(--text-2)',
      transition: 'all .15s var(--ease)', ...style,
    }}><Icon name={name} size={size > 36 ? 20 : 17} /></button>
  );
}

/* ---------------- Segmented toggle ---------------- */
export function SegToggle({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, gap: 2 }}>
      {options.map(o => {
        const active = value === o.v;
        const c = o.tone === 'win' ? 'var(--win)' : o.tone === 'urgent' ? 'var(--urgent)' : o.tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '5px 10px', fontSize: 12, fontWeight: 650, borderRadius: 6, border: 'none', whiteSpace: 'nowrap',
            background: active ? c : 'transparent', color: active ? 'var(--on-color)' : 'var(--text-2)', transition: 'all .14s var(--ease)',
            cursor: 'pointer',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

/* ---------------- Toggle switch ---------------- */
export function Switch({ on, onChange, label }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    }}>
      <span style={{
        width: 38, height: 22, borderRadius: 99, padding: 2, flex: 'none',
        background: on ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .2s var(--ease)',
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
      }}>
        <span style={{ width: 18, height: 18, borderRadius: 99, background: 'var(--on-color)', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'all .2s var(--ease)' }} />
      </span>
      {label && <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 550 }}>{label}</span>}
    </button>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ initial, size = 36, admin }) {
  return (
    <span style={{ position: 'relative', flex: 'none' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '32%',
        background: 'linear-gradient(135deg, var(--accent), var(--home))', color: 'var(--on-color)',
        fontWeight: 750, fontSize: size * 0.42,
      }}>{initial}</span>
      {admin && <span style={{
        position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 99,
        background: 'var(--warn)', color: 'var(--on-color)', display: 'grid', placeItems: 'center', border: '2px solid var(--surface)',
      }}><Icon name="shield" size={9} stroke={2.5} /></span>}
    </span>
  );
}

/* ---------------- Sheet (mobile bottom) / Drawer wrapper ---------------- */
export function Overlay({ onClose, children, align = 'center', maxW = 460 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const isSheet = align === 'bottom';
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,18,30,.45)',
      backdropFilter: 'blur(2px)', display: 'flex',
      alignItems: isSheet ? 'flex-end' : 'center', justifyContent: 'center',
      animation: 'fadeIn .18s var(--ease)', padding: isSheet ? 0 : 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: isSheet ? 560 : maxW,
        background: 'var(--surface)', borderRadius: isSheet ? '20px 20px 0 0' : 'var(--r-lg)',
        boxShadow: 'var(--shadow-3)', maxHeight: isSheet ? '88vh' : '86vh', overflow: 'auto',
        animation: (isSheet ? 'slideUp' : 'popIn') + ' .26s var(--ease-out)',
        border: '1px solid var(--border)',
      }}>{children}</div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function Empty({ icon = 'inbox', title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-3)' }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 15 }}>{title}</div>
      {sub && <div style={{ marginTop: 5, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

/* ---------------- Spinner ---------------- */
export function Spinner({ size = 16 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-block',
      border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)',
      animation: 'spin .7s linear infinite',
    }} />
  );
}

/* ---------------- Brandmark ---------------- */
export function Brandmark({ size = 44 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: size, height: size, borderRadius: size * 0.3, background: 'linear-gradient(140deg, var(--accent), var(--home))', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px -6px var(--accent)' }}>
        <Icon name="trophy" size={size * 0.5} stroke={2} style={{ color: 'var(--on-color)' }} />
      </span>
      <span style={{ fontSize: size * 0.46, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>당첨노트</span>
    </span>
  );
}

/* ---------------- Floating theme toggle (auth gate) ---------------- */
export function ThemeToggleFloat({ theme, onToggle }) {
  return (
    <button onClick={onToggle} title="테마 전환" style={{
      position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 11,
      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)',
      display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-1)', cursor: 'pointer',
    }}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
  );
}
