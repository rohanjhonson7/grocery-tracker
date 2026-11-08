import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { StoreBadge, TabBar } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { supabase } from '../lib/supabase';
import type { Expense, ExpenseCategory } from '../lib/types';
import { fmtDay, fmtMoney, todayISO } from '../lib/util';

const CAT_LABEL: Record<ExpenseCategory, string> = { grocery: 'Grocery', household: 'Household', misc: 'Misc' };

function monthBounds(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { start: todayISO(start), end: todayISO(end), label: start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) };
}

function Breakdown({ title, rows, total }: { title: string; rows: { key: string; label: string; value: number; lead?: ReactNode }[]; total: number }) {
  if (!rows.length) return null;
  return (
    <section className="card pad stack gap-12" aria-label={title}>
      <h2 className="h3">{title}</h2>
      <ul className="stack gap-12" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((r) => {
          const pct = total ? (r.value / total) * 100 : 0;
          return (
            <li key={r.key} className="stack gap-6">
              <div className="row" style={{ gap: 10 }}>
                {r.lead}
                <span className="grow ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtMoney(r.value)}</span>
                <span className="sub" style={{ width: 40, textAlign: 'right' }}>{Math.round(pct)}%</span>
              </div>
              <div aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--soft)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)', borderRadius: 4 }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Spending() {
  const { household, stores, storeById, personName } = useApp();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const m = monthBounds(offset);

  const load = useCallback(async () => {
    if (!household) return;
    setRows(null);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .gte('expense_date', m.start)
      .lte('expense_date', m.end)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast(error.message);
    setRows((data ?? []) as Expense[]);
  }, [household, m.start, m.end, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => (rows ?? []).reduce((s, e) => s + Number(e.amount), 0), [rows]);

  const byStore = useMemo(() => {
    const map = new Map<string, { label: string; value: number; storeId: string | null }>();
    for (const e of rows ?? []) {
      const k = e.store_id ?? e.store_name ?? 'other';
      const cur = map.get(k) ?? { label: storeById(e.store_id)?.name ?? e.store_name ?? 'Other', value: 0, storeId: e.store_id };
      cur.value += Number(e.amount);
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, label: v.label, value: v.value, lead: <StoreBadge store={storeById(v.storeId) ?? stores.find((s) => s.name === v.label)} size={24} /> }))
      .sort((a, b) => b.value - a.value);
  }, [rows, storeById, stores]);

  const byCat = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of rows ?? []) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    return [...map.entries()].map(([k, v]) => ({ key: k, label: CAT_LABEL[k], value: v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const remove = async (e: Expense) => {
    if (!window.confirm(`Delete the ${fmtMoney(Number(e.amount))} entry from ${fmtDay(e.expense_date)}?`)) return;
    const { error } = await supabase.from('expenses').delete().eq('id', e.id);
    if (error) toast(error.message);
    await load();
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="h1">Spending</h1>
      </header>

      <main className="content" style={{ paddingTop: 10 }}>
        <div className="between card" style={{ padding: 4 }}>
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setOffset((o) => o - 1)}>
            <Icon name="chevron-left" size={22} stroke={2.25} />
          </button>
          <span style={{ fontWeight: 700 }}>{m.label}</span>
          <button type="button" className="icon-btn" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} style={{ opacity: offset >= 0 ? 0.3 : 1 }}>
            <Icon name="chevron-right" size={22} stroke={2.25} />
          </button>
        </div>

        <section className="tint-green" style={{ padding: '18px 20px' }} aria-label="Total spent">
          <div className="eyebrow" style={{ color: 'var(--green-dark)' }}>Spent in {m.label.split(' ')[0]}</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{rows ? fmtMoney(total) : '—'}</div>
          <div className="sub" style={{ color: 'var(--ink-2)' }}>
            {rows ? `${rows.length} ${rows.length === 1 ? 'trip' : 'trips'} logged` : 'Loading…'}
          </div>
        </section>

        {rows && rows.length === 0 && (
          <p className="empty card" style={{ margin: 0 }}>
            Nothing logged this month. When you finish a trip, add what you paid and it shows up here.
          </p>
        )}

        <Breakdown title="By store" rows={byStore} total={total} />
        <Breakdown title="By category" rows={byCat} total={total} />

        {rows && rows.length > 0 && (
          <section className="card" aria-label="Entries" style={{ overflow: 'hidden' }}>
            <h2 className="h3" style={{ padding: '14px 16px 6px' }}>Entries</h2>
            <div className="divided">
              {rows.map((e) => (
                <div key={e.id} className="row" style={{ padding: '8px 6px 8px 16px' }}>
                  <div className="grow">
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{storeById(e.store_id)?.name ?? e.store_name ?? 'Other'}</div>
                    <div className="sub">{fmtDay(e.expense_date)} · {CAT_LABEL[e.category]} · by {personName(e.added_by)}</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>{fmtMoney(Number(e.amount))}</span>
                  <button type="button" className="icon-btn" aria-label={`Delete entry from ${fmtDay(e.expense_date)}`} onClick={() => remove(e)} style={{ color: 'var(--muted)' }}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <TabBar />
    </div>
  );
}
