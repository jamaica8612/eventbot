/* ============================================================
   당첨노트 — UI Primitives
   ============================================================ */

/* ---- Icon ---- */
const ICON = {
  clock:       'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  hourglass:   'M6 3h12 M6 21h12 M7 3c0 4 2 6 5 9 3-3 5-5 5-9 M7 21c0-4 2-6 5-9 3 3 5 5 5 9',
  search:      'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  inbox:       'M3 12h5l2 3h4l2-3h5 M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-7Z',
  bookmark:    'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z',
  gift:        'M20 12v9H4v-9 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
  shield:      'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  filter:      'M3 5h18 M6 12h12 M10 19h4',
  sun:         'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  moon:        'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  lock:        'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M8 11V7a4 4 0 0 1 8 0v4',
  chevDown:    'M6 9l6 6 6-6',
  chevRight:   'M9 6l6 6-6 6',
  chevLeft:    'M15 6l-6 6 6 6',
  ext:         'M14 4h6v6 M20 4l-9 9 M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6',
  check:       'M5 13l4 4L19 7',
  checkCircle: 'M9 12l2 2 4-4 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  x:           'M6 6l12 12 M18 6L6 18',
  xCircle:     'M15 9l-6 6 M9 9l6 6 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  pencil:      'M16.5 3.5l4 4L8 20l-4 1 1-4 11.5-11.5Z',
  copy:        'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z M4 15V4a1 1 0 0 1 1-1h11',
  plus:        'M12 5v14 M5 12h14',
  trash:       'M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  undo:        'M3 7v6h6 M3.5 13a9 9 0 1 0 2-7.5L3 13',
  play:        'M6 4l14 8-14 8V4Z',
  refresh:     'M21 12a9 9 0 1 1-2.6-6.3 M21 4v5h-5',
  alert:       'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  bell:        'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  calendar:    'M7 3v3 M17 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  sparkles:    'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15Z',
  menu:        'M4 6h16 M4 12h16 M4 18h16',
  dots:        'M5 12h.01 M12 12h.01 M19 12h.01',
  link:        'M9 15l6-6 M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1 M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1',
  trophy:      'M8 4h8v4a4 4 0 0 1-8 0V4Z M8 6H5a2 2 0 0 0 0 4h1 M16 6h3a2 2 0 0 1 0 4h-1 M10 13.5V17 M14 13.5V17 M8 21h8 M9 17h6v4H9z',
  wand:        'M4 20l10-10 M14.5 5.5l4 4 M16 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z',
  cloud:       'M7 18a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 9a4 4 0 0 1 0 9H7Z',
  arrowUp:     'M12 19V5 M6 11l6-6 6 6',
  upload:      'M12 16V4 M7 9l5-5 5 5 M5 20h14',
  user:        'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 21a7 7 0 0 1 14 0',
  flame:       'M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.6 1.5-3.5C9 10 9 8 12 3Z',
  eye:         'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

export function Icon({ name, size = 18, stroke = 1.7, fill = 'none', className = '', style }) {
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
        <path fill="#4285F4" d="M21.6 12.2c0-.6-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2Z"/>
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/>
        <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6L6.4 14Z"/>
        <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z"/>
      </svg>
    );
  }
  const d = ICON[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {d && d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

/* ---- Badge ---- */
const TONE = {
  muted:  { fg: 'var(--text-2)',       bg: 'var(--surface-3)' },
  accent: { fg: 'var(--accent-text)',  bg: 'var(--accent-weak)' },
  warn:   { fg: 'var(--warn-text)',    bg: 'var(--warn-weak)' },
  urgent: { fg: 'var(--urgent-text)',  bg: 'var(--urgent-weak)' },
  win:    { fg: 'var(--win-text)',     bg: 'var(--win-weak)' },
  lose:   { fg: 'var(--text-2)',       bg: 'var(--lose-weak)' },
  info:   { fg: 'var(--info)',         bg: 'var(--info-weak)' },
};

export function Badge({ tone = 'muted', children, icon, solid, style }) {
  const t = TONE[tone] || TONE.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 650,
      lineHeight: 1.3, whiteSpace: 'nowrap',
      color: solid ? '#fff' : t.fg,
      background: solid ? t.fg : t.bg,
      ...style,
    }}>
      {icon && <Icon name={icon} size={12} stroke={2.2} />}
      {children}
    </span>
  );
}

/* ---- PlatformBadge ---- */
function platformMeta(p = '') {
  const lp = String(p).toLowerCase();
  if (lp.includes('youtube') || lp.includes('유튜브')) return { label: 'YouTube', short: 'YT', c: 'var(--yt)',    weak: 'var(--yt-weak)' };
  if (lp.includes('naver')   || lp.includes('네이버')) return { label: '네이버',  short: 'N',  c: 'var(--naver)', weak: 'var(--naver-weak)' };
  if (lp.includes('슈퍼투데이') || lp.includes('home') || lp.includes('홈페이지')) return { label: '슈퍼투데이', short: '슈', c: 'var(--home)', weak: 'var(--home-weak)' };
  return { label: p || '기타', short: '?', c: 'var(--text-3)', weak: 'var(--surface-3)' };
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

/* ---- Chip ---- */
export function Chip({ active, onClick, children, count, tone, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
      background: active
        ? (tone === 'urgent' ? 'var(--urgent)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)')
        : 'var(--surface)',
      color: active ? '#fff' : 'var(--text-2)',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
      transition: 'all .15s var(--ease)', whiteSpace: 'nowrap',
    }}>
      {children}
      {count != null && (
        <span className="tnum" style={{
          fontSize: 11, fontWeight: 700, padding: '0 5px', borderRadius: 99, minWidth: 16, textAlign: 'center',
          background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-3)',
          color: active ? '#fff' : 'var(--text-3)',
        }}>{count}</span>
      )}
    </button>
  );
}

/* ---- Button ---- */
const BTN_VARIANTS = {
  primary: { background: 'var(--accent)',          color: 'var(--on-accent)',    borderColor: 'transparent' },
  default: { background: 'var(--surface)',          color: 'var(--text)',         borderColor: 'var(--border-strong)' },
  ghost:   { background: 'transparent',             color: 'var(--text-2)',       borderColor: 'transparent' },
  soft:    { background: 'var(--surface-3)',        color: 'var(--text)',         borderColor: 'transparent' },
  win:     { background: 'var(--win)',              color: '#fff',                borderColor: 'transparent' },
  urgent:  { background: 'var(--urgent)',           color: '#fff',                borderColor: 'transparent' },
  warn:    { background: 'var(--warn)',             color: '#fff',                borderColor: 'transparent' },
  outline: { background: 'transparent',             color: 'var(--text)',         borderColor: 'var(--border-strong)' },
};

export function Button({ variant = 'default', size = 'md', icon, iconRight, children, onClick, disabled, full, style, title, type = 'button' }) {
  const sizes = { sm: '6px 11px', md: '9px 15px', lg: '12px 20px' };
  const fs    = { sm: 13, md: 13.5, lg: 15 };
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.default;
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: sizes[size], fontSize: fs[size], fontWeight: 650, borderRadius: 'var(--r-sm)',
      border: '1px solid ' + (v.borderColor || 'transparent'),
      background: v.background, color: v.color,
      transition: 'all .15s var(--ease)',
      width: full ? '100%' : undefined, whiteSpace: 'nowrap',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      ...style,
    }}>
      {icon && <Icon name={icon} size={size === 'lg' ? 17 : 15} stroke={2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} stroke={2} />}
    </button>
  );
}

/* ---- IconBtn ---- */
export function IconBtn({ name, onClick, active, title, size = 34, style }) {
  return (
    <button title={title} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 'var(--r-sm)', flex: 'none',
      border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
      background: active ? 'var(--accent-weak)' : 'var(--surface)',
      color: active ? 'var(--accent-text)' : 'var(--text-2)',
      transition: 'all .15s var(--ease)', cursor: 'pointer',
      ...style,
    }}>
      <Icon name={name} size={size > 36 ? 20 : 17} />
    </button>
  );
}

/* ---- Switch ---- */
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
        <span style={{ width: 18, height: 18, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'all .2s var(--ease)' }} />
      </span>
      {label && <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 550 }}>{label}</span>}
    </button>
  );
}

/* ---- Avatar ---- */
export function Avatar({ initial, size = 36, admin }) {
  return (
    <span style={{ position: 'relative', flex: 'none' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '32%',
        background: 'linear-gradient(135deg, var(--accent), var(--home))', color: '#fff',
        fontWeight: 750, fontSize: size * 0.42,
      }}>{initial}</span>
      {admin && (
        <span style={{
          position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 99,
          background: 'var(--warn)', color: '#fff', display: 'grid', placeItems: 'center',
          border: '2px solid var(--surface)',
        }}>
          <Icon name="shield" size={9} stroke={2.5} />
        </span>
      )}
    </span>
  );
}

/* ---- Empty state ---- */
export function Empty({ icon = 'inbox', title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-3)' }}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16,
        background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--text-3)',
      }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 15 }}>{title}</div>
      {sub && <div style={{ marginTop: 5, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

/* ---- Overlay / Sheet ---- */
export function Overlay({ onClose, children, align = 'center', maxW = 460 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,18,30,.45)',
      backdropFilter: 'blur(2px)', display: 'flex',
      alignItems: align === 'bottom' ? 'flex-end' : 'center', justifyContent: 'center',
      animation: 'fadeIn .18s var(--ease)', padding: align === 'bottom' ? 0 : 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: align === 'bottom' ? 560 : maxW,
        background: 'var(--surface)', borderRadius: align === 'bottom' ? '20px 20px 0 0' : 'var(--r-lg)',
        boxShadow: 'var(--shadow-3)', maxHeight: align === 'bottom' ? '88vh' : '86vh', overflow: 'auto',
        animation: (align === 'bottom' ? 'slideUp' : 'popIn') + ' .26s var(--ease-out)',
        border: '1px solid var(--border)',
      }}>{children}</div>
    </div>
  );
}

/* ---- Seg (segmented control) ---- */
export function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '3px 4px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
            border: 'none', whiteSpace: 'nowrap',
            background: value === opt.value ? 'var(--surface)' : 'transparent',
            color: value === opt.value ? 'var(--text)' : 'var(--text-3)',
            boxShadow: value === opt.value ? 'var(--shadow-1)' : 'none',
            transition: 'all .15s var(--ease)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
