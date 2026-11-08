import type { CatalogItem, CustomItem, Frequency, Pickable } from './types';

/** Marker process_recurring_items() appends to notes of items it adds. */
export const AUTO_TAG = '[Auto-added]';

export function splitNote(notes: string | null | undefined): { note: string; auto: boolean } {
  if (!notes) return { note: '', auto: false };
  const auto = notes.includes(AUTO_TAG);
  return { note: notes.replace(AUTO_TAG, '').trim(), auto };
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** "2 kg", or "1 × 2kg" when the unit is itself a size. */
export function fmtQty(quantity: number, unit: string): string {
  const q = fmtNum(Number(quantity));
  return /^\d/.test(unit) ? `${q} × ${unit}` : `${q} ${unit}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Mon, Nov 9" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  return parseISODate(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const a = parseISODate(todayISO()).getTime();
  const b = parseISODate(iso).getTime();
  return Math.round((b - a) / 86_400_000);
}

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
export function fmtMoney(n: number): string {
  return money.format(n);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const base = name.includes('@') ? name.split('@')[0] : name;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function firstName(name: string | null | undefined): string {
  if (!name) return '';
  const base = name.includes('@') ? name.split('@')[0] : name;
  return base.split(/\s+/)[0];
}

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const FREQ_LABEL: Record<Frequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  bimonthly: 'Every 2 months',
};

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function scheduleLabel(freq: Frequency, dow: number | null, dom: number | null): string {
  if (freq === 'weekly' || freq === 'biweekly') return `${FREQ_LABEL[freq]} · ${dow != null ? DOW[dow] : '?'}`;
  return `${FREQ_LABEL[freq]} · ${dom != null ? ordinal(dom) : '?'}`;
}

export const STORE_COLORS = ['#18794A', '#0071CE', '#E31837', '#FF9933', '#7C3AED', '#0F766E', '#B45309', '#DB2777'];

/** Readable foreground on a store color (yellow stores get dark icons). */
export function onColor(hex: string | null | undefined): string {
  if (!hex) return '#FFFFFF';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.62 ? '#16241B' : '#FFFFFF';
}

// ---------- search ----------

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function scoreText(text: string, q: string): number {
  const t = norm(text);
  if (!t) return 0;
  if (t === q) return 100;
  const words = t.split(/[\s/(),-]+/).filter(Boolean);
  if (words.includes(q)) return 90; // "dal" in "Toor Dal (Pigeon Peas)"
  if (t.startsWith(q)) return 80;
  if (words.some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 35;
  return 0;
}

/** Name and Hindi name count fully; other names (synonyms) rank a little lower. */
function bestScore(primary: (string | null | undefined)[], secondary: (string | null | undefined)[], q: string): number {
  let best = 0;
  for (const t of primary) if (t) best = Math.max(best, scoreText(t, q));
  for (const t of secondary) if (t) best = Math.max(best, scoreText(t, q) - 15);
  return best;
}

export function searchItems(query: string, catalog: CatalogItem[], custom: CustomItem[], limit = 30): Pickable[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { p: Pickable; s: number; name: string }[] = [];
  for (const c of custom) {
    const s = bestScore([c.name], [], q);
    if (s > 0) scored.push({ p: { kind: 'custom', item: c }, s: s + 10 + Math.min(c.usage_count, 20), name: c.name });
  }
  for (const c of catalog) {
    const s = bestScore([c.name, c.name_hindi], c.synonyms ?? [], q);
    if (s > 0) scored.push({ p: { kind: 'catalog', item: c }, s, name: c.name });
  }
  scored.sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((x) => x.p);
}

export function pickableName(p: Pickable): string {
  return p.item.name;
}

export function pickableHindi(p: Pickable): string | null {
  return p.kind === 'catalog' ? p.item.name_hindi : null;
}

export function pickableUnits(p: Pickable): string[] {
  const units = p.kind === 'catalog' ? p.item.available_units ?? [] : p.item.available_units ?? [];
  const def = p.kind === 'catalog' ? p.item.default_unit : p.item.default_unit;
  const all = [...(def ? [def] : []), ...units];
  return Array.from(new Set(all.filter(Boolean))) as string[];
}

export function pickableDefaultUnit(p: Pickable): string {
  return (p.kind === 'catalog' ? p.item.default_unit : p.item.default_unit) || pickableUnits(p)[0] || 'piece';
}
