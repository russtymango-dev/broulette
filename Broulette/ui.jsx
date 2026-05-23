// ui.jsx — Reusable UI primitives for Broulette

const { useState, useEffect, useRef, useMemo } = React;

// ────────────────────────────────────────────────────────────
// Icons (inline SVG, currentColor)
// ────────────────────────────────────────────────────────────
const Ico = {
  Glass: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 3h10l-1 11a4 4 0 0 1-4 4 4 4 0 0 1-4-4L7 3z" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <line x1="8" y1="8" x2="16" y2="8" />
    </svg>
  ),
  Home: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
    </svg>
  ),
  Bets: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="14.5" r="1" fill="currentColor"/><circle cx="12" cy="14.5" r="1" fill="currentColor"/><circle cx="16" cy="14.5" r="1" fill="currentColor"/>
    </svg>
  ),
  Wheel: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
    </svg>
  ),
  Feed: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" />
    </svg>
  ),
  Crown: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6L4 8z" />
    </svg>
  ),
  Send: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Back: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2L4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
    </svg>
  ),
  Trophy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" />
      <path d="M16 4h3v3a3 3 0 0 1-3 3M8 4H5v3a3 3 0 0 0 3 3" />
      <path d="M12 12v5M8 21h8" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  ChevR: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  ),
};

// ────────────────────────────────────────────────────────────
// Decorative ornament — laurel sprig (subtle wedding flourish)
// ────────────────────────────────────────────────────────────
function Laurel({ size = 28, color = 'var(--gold-deep)' }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 60 30" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round">
      <path d="M5 15 Q 30 5 55 15" />
      <path d="M10 14 Q 12 10 16 11" />
      <path d="M18 12 Q 20 8 24 9" />
      <path d="M26 10 Q 28 6 32 7" />
      <path d="M34 10 Q 36 6 40 7" />
      <path d="M42 12 Q 44 8 48 9" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────
// Avatar
// ────────────────────────────────────────────────────────────
function Avatar({ player, size = '' }) {
  if (!player) return null;
  const init = (player.firstName?.[0] || '?') + (player.lastInitial?.[0] || '');
  return (
    <div className={`avatar ${player.avatar || 'blush'} ${size}`}>{init}</div>
  );
}

// ────────────────────────────────────────────────────────────
// Drink count display (with little glass icon)
// ────────────────────────────────────────────────────────────
function DrinkCount({ value, size = 'lg' }) {
  return (
    <span className={size === 'lg' ? 'drink-count' : 'drink-count-sm'}>
      {value}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Tab bar
// ────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, isAdmin }) {
  const tabs = [
    { id: 'home',  label: 'Home',  ic: <Ico.Home /> },
    { id: 'bets',  label: 'Bets',  ic: <Ico.Bets /> },
    { id: 'wheel', label: 'Wheel', ic: <Ico.Wheel /> },
    { id: 'feed',  label: 'Feed',  ic: <Ico.Feed /> },
    isAdmin
      ? { id: 'admin', label: 'Admin', ic: <Ico.Shield />, admin: true }
      : { id: 'top', label: 'Top',  ic: <Ico.Crown /> },
  ];
  return (
    <nav className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`tab-btn ${tab === t.id ? 'active' : ''} ${t.admin ? 'admin' : ''}`}
        >
          {React.cloneElement(t.ic, { className: 'ic' })}
          <span className="label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────
// Page header
// ────────────────────────────────────────────────────────────
function PageHead({ title, subtitle, left, right }) {
  return (
    <div className="page-head">
      {left || <div />}
      <div style={{ flex: 1, textAlign: 'center' }}>
        {subtitle && <div className="subtitle">{subtitle}</div>}
        <h1>{title}</h1>
      </div>
      {right || <div />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Bottom sheet
// ────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: 'var(--ink-mute)' }}>
              <Ico.X width={22} height={22} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Dialog
// ────────────────────────────────────────────────────────────
function Dialog({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Stepper (for drink amounts)
// ────────────────────────────────────────────────────────────
function Stepper({ value, onChange, min = 1, max = 999 }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'var(--paper)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-pill)', padding: 4,
    }}>
      <button
        onClick={() => onChange(clamp(value - 1))}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--paper-2)', border: 0, cursor: 'pointer',
          fontSize: 22, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
      <div style={{
        flex: 1, textAlign: 'center', minWidth: 80,
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 32,
      }}>{value}</div>
      <button
        onClick={() => onChange(clamp(value + 1))}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--paper)', border: 0, cursor: 'pointer',
          fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Decorative ornamental divider
// ────────────────────────────────────────────────────────────
function Ornament({ glyph = '✦' }) {
  return (
    <div className="div-orn">
      <span className="glyph">{glyph}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Toast renderer (per-player)
// ────────────────────────────────────────────────────────────
function ToastStack({ playerId, store }) {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    if (!playerId) return;
    const tick = () => {
      const fresh = store.drainToasts(playerId);
      if (fresh.length) {
        setToasts((cur) => [...cur, ...fresh]);
        fresh.forEach((t) => {
          setTimeout(() => {
            setToasts((cur) => cur.filter((x) => x.id !== t.id));
          }, 3800);
        });
      }
    };
    tick();
    return store.subscribe(tick);
  }, [playerId, store]);

  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className="toast-icon">{t.icon}</div>
          <div style={{ flex: 1 }}>{t.text}</div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Empty state
// ────────────────────────────────────────────────────────────
function EmptyState({ glyph = '✦', title, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--ink-mute)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--gold-deep)', marginBottom: 12 }}>{glyph}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      {hint && <div style={{ fontSize: 14 }}>{hint}</div>}
    </div>
  );
}

Object.assign(window, {
  Ico, Laurel, Avatar, DrinkCount, TabBar, PageHead,
  Sheet, Dialog, Stepper, Ornament, ToastStack, EmptyState,
});
