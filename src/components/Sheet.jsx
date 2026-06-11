import { useEffect } from 'react';

export function Sheet({ onClose, children, align = 'center', maxW = 460 }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isBottom = align === 'bottom';
  const isRight  = align === 'right';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 80,
    background: 'rgba(15,18,30,.45)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: isBottom ? 'flex-end' : 'center',
    justifyContent: isRight ? 'flex-end' : 'center',
    animation: 'fadeIn .18s var(--ease)',
    padding: isBottom || isRight ? 0 : 20,
  };

  const panelStyle = {
    width: '100%',
    maxWidth: isBottom ? 560 : isRight ? 400 : maxW,
    background: 'var(--surface)',
    borderRadius: isBottom ? 'var(--r-lg) var(--r-lg) 0 0'
                : isRight  ? 0
                : 'var(--r-lg)',
    boxShadow: 'var(--shadow-3)',
    maxHeight: isRight ? '100dvh' : '88vh',
    height: isRight ? '100dvh' : undefined,
    overflowY: 'auto',
    border: '1px solid var(--border)',
    animation: (isBottom ? 'slideUp' : 'popIn') + ' .26s var(--ease-out)',
  };

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
