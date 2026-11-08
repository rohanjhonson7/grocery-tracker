import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Icon } from './Icon';
import type { Category, Store } from '../lib/types';
import { onColor } from '../lib/util';

const CAT_TINT: Record<string, [string, string]> = {
  wheat: ['#FFF1D6', '#8A5800'],
  grain: ['#FBEBDD', '#9C4A12'],
  milk: ['#E8F1FB', '#2A5F9E'],
  carrot: ['#E5F3EA', '#18794A'],
  apple: ['#FDE9EC', '#B4233C'],
  flame: ['#FDE8DF', '#B3401A'],
  droplet: ['#FFF6D6', '#7A5E00'],
  cookie: ['#F3ECFA', '#6B3FA0'],
  coffee: ['#F1EAE4', '#6B4226'],
  snowflake: ['#E4F4F7', '#1F6E80'],
  croissant: ['#FFF1D6', '#8A5800'],
  drumstick: ['#FDE9EC', '#9F1239'],
  archive: ['#EEF1EA', '#3E4C43'],
  'spray-can': ['#E4F4F7', '#0F766E'],
  scroll: ['#F0F3EC', '#56665B'],
  heart: ['#FCE7F3', '#9D174D'],
  utensils: ['#EEF1EA', '#3E4C43'],
  box: ['#F0F3EC', '#56665B'],
};

export function CategoryBadge({ category, size = 28 }: { category: Category | null; size?: number }) {
  const [bg, fg] = CAT_TINT[category?.icon ?? 'box'] ?? CAT_TINT.box;
  return (
    <span className="cat-badge" aria-hidden="true" style={{ background: bg, color: fg, width: size, height: size }}>
      <Icon name={category?.icon ?? 'box'} size={Math.round(size * 0.57)} />
    </span>
  );
}

export function StoreBadge({ store, size = 44 }: { store: Store | undefined; size?: number }) {
  const color = store?.color || '#18794A';
  return (
    <span
      className="badge"
      aria-hidden="true"
      style={{ width: size, height: size, background: color, color: onColor(color), borderRadius: Math.round(size * 0.32) }}
    >
      <Icon name={store?.icon || 'store'} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <span><span /></span>
    </button>
  );
}

export function Sheet({ label, onClose, children, tall }: { label: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={'sheet' + (tall ? ' tall' : '')} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function SheetHead({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-head">
      {children}
      <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto' }}>
        <Icon name="x" size={22} stroke={2.25} />
      </button>
    </div>
  );
}

export function Stepper({ value, onChange, label = 'Quantity' }: { value: number; onChange: (v: number) => void; label?: string }) {
  const step = (d: number) => {
    const next = Math.max(0.25, Math.round((value + d) * 100) / 100);
    onChange(value < 1 && d > 0 ? 1 : next);
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Less" onClick={() => step(value > 1 ? -1 : -0.25)}>
        <Icon name="minus" size={18} stroke={2.5} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'));
          if (!Number.isNaN(n) && n > 0) onChange(n);
        }}
      />
      <button type="button" aria-label="More" onClick={() => step(1)}>
        <Icon name="plus" size={18} stroke={2.5} />
      </button>
    </div>
  );
}

export function Loading() {
  return (
    <div className="center-screen" role="status" aria-label="Loading">
      <div className="spinner" />
    </div>
  );
}

const TABS = [
  { to: '/', label: 'Lists', icon: 'list', end: true },
  { to: '/repeats', label: 'Repeats', icon: 'repeat' },
  { to: '/spending', label: 'Spending', icon: 'wallet' },
  { to: '/family', label: 'Family', icon: 'users' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
          <span className="pillbg">
            <Icon name={t.icon} size={20} />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
