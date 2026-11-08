import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet, SheetHead, Stepper, StoreBadge, Switch, TabBar } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { supabase } from '../lib/supabase';
import type { Frequency, Pickable, RecurringItem } from '../lib/types';
import {
  DOW, FREQ_LABEL, daysUntil, fmtDay, fmtQty, ordinal, pickableDefaultUnit, pickableHindi, pickableName, pickableUnits,
  scheduleLabel, searchItems,
} from '../lib/util';

export default function Repeats() {
  const { recurring, catalog, showHindi, storeById, itemInfo, refreshRecurring } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState<RecurringItem | 'new' | null>(null);

  const groups = useMemo(() => {
    const soon = recurring.filter((r) => r.is_active && daysUntil(r.next_add_date) <= 7);
    const later = recurring.filter((r) => r.is_active && daysUntil(r.next_add_date) > 7);
    const paused = recurring.filter((r) => !r.is_active);
    return [
      { title: 'Next 7 days', rows: soon },
      { title: 'Later', rows: later },
      { title: 'Paused', rows: paused },
    ].filter((g) => g.rows.length);
  }, [recurring]);

  const setActive = async (r: RecurringItem, on: boolean) => {
    const { error } = await supabase.from('recurring_items').update({ is_active: on }).eq('id', r.id);
    if (error) toast(error.message);
    await refreshRecurring();
  };

  return (
    <div className="screen">
      <header className="topbar" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 className="h1">Repeats</h1>
          <p className="sub" style={{ margin: '4px 0 0', fontSize: 14 }}>Items that add themselves to your lists</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} stroke={2.5} /> New
        </button>
      </header>

      <main className="content" style={{ gap: 10, paddingTop: 14 }}>
        {recurring.length === 0 && (
          <div className="card empty">
            <p style={{ margin: '0 0 12px' }}>
              Milk every Monday? Atta once a month? Set it once and it lands on that store's list by itself.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} stroke={2.5} /> Add a repeat
            </button>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="stack gap-10">
            <h2 className="caps">{g.title}</h2>
            <div className="card divided" style={{ overflow: 'hidden' }}>
              {g.rows.map((r) => {
                const info = itemInfo(r);
                const cat = r.catalog_item_id ? catalog.find((c) => c.id === r.catalog_item_id) : undefined;
                const store = storeById(r.store_id);
                return (
                  <div key={r.id} className="row" style={{ padding: '10px 6px 10px 14px', background: r.is_active ? undefined : '#FAFBF8' }}>
                    <span style={{ opacity: r.is_active ? 1 : 0.45 }}><StoreBadge store={store} size={36} /></span>
                    <button type="button" className="grow" onClick={() => setEditing(r)} style={{ border: 'none', background: 'none', padding: '2px 0', textAlign: 'left' }} aria-label={`Edit repeat for ${info.name}`}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: r.is_active ? undefined : 'var(--ink-2)' }}>
                        {info.name} {showHindi && cat?.name_hindi && <span lang="hi" style={{ fontWeight: 500, color: 'var(--muted)' }}>{cat.name_hindi}</span>}
                      </div>
                      <div className="sub" style={{ color: 'var(--ink-2)' }}>{fmtQty(r.quantity, r.unit)} · {store?.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: r.is_active ? 'var(--saffron-ink)' : 'var(--muted)', marginTop: 3 }}>
                        {r.is_active
                          ? `${scheduleLabel(r.frequency, r.day_of_week, r.day_of_month)} — next ${fmtDay(r.next_add_date)}`
                          : `Paused · ${FREQ_LABEL[r.frequency].toLowerCase()}`}
                      </div>
                    </button>
                    <Switch checked={r.is_active} onChange={(v) => setActive(r, v)} label={`Repeat ${info.name}`} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="notice" style={{ marginTop: 6 }}>
          <Icon name="repeat" size={18} style={{ color: 'var(--saffron-ink)', flex: 'none', marginTop: 1 }} />
          <p style={{ margin: 0 }}>On its day, each item drops into that store's list when someone opens the app. If it's already waiting there, it isn't added twice.</p>
        </div>
      </main>

      <TabBar />

      {editing && <RepeatEditor repeat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const FREQS: Frequency[] = ['weekly', 'biweekly', 'monthly', 'bimonthly'];

function RepeatEditor({ repeat, onClose }: { repeat: RecurringItem | null; onClose: () => void }) {
  const { catalog, customItems, stores, lists, household, userId, showHindi, itemInfo, refreshRecurring, refreshLists } = useApp();
  const toast = useToast();

  const initialPick: Pickable | null = repeat
    ? repeat.catalog_item_id
      ? (() => {
          const c = catalog.find((x) => x.id === repeat.catalog_item_id);
          return c ? { kind: 'catalog' as const, item: c } : null;
        })()
      : repeat.custom_item_id
        ? (() => {
            const c = customItems.find((x) => x.id === repeat.custom_item_id);
            return c ? { kind: 'custom' as const, item: c } : null;
          })()
        : null
    : null;

  const [pick, setPick] = useState<Pickable | null>(initialPick);
  const [freeName, setFreeName] = useState(repeat && !initialPick ? itemInfo(repeat).name : '');
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState(repeat?.store_id ?? lists[0]?.store_id ?? stores[0]?.id ?? '');
  const [qty, setQty] = useState(repeat ? Number(repeat.quantity) : 1);
  const [unit, setUnit] = useState(repeat?.unit ?? 'piece');
  const [freq, setFreq] = useState<Frequency>(repeat?.frequency ?? 'weekly');
  const [dow, setDow] = useState(repeat?.day_of_week ?? new Date().getDay());
  const [dom, setDom] = useState(repeat?.day_of_month ?? Math.min(new Date().getDate(), 28));
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => searchItems(query, catalog, customItems, 8), [query, catalog, customItems]);
  const chosenName = pick ? pickableName(pick) : freeName;
  const units = pick ? pickableUnits(pick) : [unit];
  const weekly = freq === 'weekly' || freq === 'biweekly';

  const choose = (p: Pickable) => {
    setPick(p);
    setFreeName('');
    setUnit(pickableDefaultUnit(p));
    setQuery('');
    if (!repeat && p.kind === 'catalog' && p.item.suggested_stores?.length) {
      const s = stores.find((x) => x.name === p.item.suggested_stores![0]);
      if (s) setStoreId(s.id);
    }
  };

  const save = async () => {
    if (!household || !chosenName || !storeId) return;
    setBusy(true);
    const row = {
      household_id: household.id,
      store_id: storeId,
      catalog_item_id: pick?.kind === 'catalog' ? pick.item.id : null,
      custom_item_id: pick?.kind === 'custom' ? pick.item.id : null,
      item_name: pick ? null : freeName.trim(),
      quantity: qty,
      unit: unit || 'piece',
      frequency: freq,
      day_of_week: weekly ? dow : null,
      day_of_month: weekly ? null : dom,
    };
    const { error } = repeat
      ? await supabase.from('recurring_items').update(row).eq('id', repeat.id)
      : await supabase.from('recurring_items').insert({ ...row, is_active: true, created_by: userId });
    if (error) {
      toast(error.message);
      setBusy(false);
      return;
    }
    // Add it now if it's due today.
    const { data } = await supabase.rpc('process_recurring_items');
    await refreshRecurring();
    if (typeof data === 'number' && data > 0) await refreshLists();
    toast(repeat ? 'Repeat updated' : `${chosenName} will repeat ${FREQ_LABEL[freq].toLowerCase()}`);
    onClose();
  };

  const remove = async () => {
    if (!repeat || !window.confirm(`Stop repeating ${chosenName}?`)) return;
    const { error } = await supabase.from('recurring_items').delete().eq('id', repeat.id);
    if (error) toast(error.message);
    await refreshRecurring();
    onClose();
  };

  return (
    <Sheet label={repeat ? 'Edit repeat' : 'New repeat'} onClose={onClose} tall>
      <SheetHead onClose={onClose}>
        <h2 className="h2">{repeat ? 'Edit repeat' : 'New repeat'}</h2>
      </SheetHead>
      <div className="sheet-body" style={{ gap: 16 }}>
        <div>
          <div className="field-label">Item</div>
          {chosenName ? (
            <div className="row card" style={{ padding: '10px 6px 10px 14px' }}>
              <div className="grow">
                <div className="item-name">{chosenName}</div>
                {showHindi && pick && pickableHindi(pick) && <div lang="hi" className="item-hi">{pickableHindi(pick)}</div>}
              </div>
              {!repeat && (
                <button type="button" className="link-btn" onClick={() => { setPick(null); setFreeName(''); }}>Change</button>
              )}
            </div>
          ) : (
            <div className="stack gap-6">
              <div className="searchbar" style={{ height: 52 }}>
                <Icon name="search" size={20} style={{ color: 'var(--muted)' }} />
                <label htmlFor="repeat-search" className="sr-only">Search items</label>
                <input id="repeat-search" autoFocus autoComplete="off" placeholder="Milk, atta, दही…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              {results.map((p) => (
                <button key={`${p.kind}:${p.item.id}`} type="button" className="result" onClick={() => choose(p)} style={{ minHeight: 52 }}>
                  <div className="grow">
                    <div className="item-name">{pickableName(p)}</div>
                    {showHindi && pickableHindi(p) && <div lang="hi" className="item-hi">{pickableHindi(p)}</div>}
                  </div>
                  <Icon name="plus" size={18} stroke={2.5} style={{ color: 'var(--green)' }} />
                </button>
              ))}
              {query.trim() && (
                <button type="button" className="link-btn" onClick={() => { setFreeName(query.trim()); setQuery(''); }}>
                  Use “{query.trim()}” as typed
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="field-label">Store</div>
          <div className="row" role="group" aria-label="Store" style={{ gap: 8, flexWrap: 'wrap' }}>
            {stores.map((s) => (
              <button key={s.id} type="button" className="store-chip" aria-pressed={s.id === storeId} onClick={() => setStoreId(s.id)}>
                <span className="swatch" style={{ background: s.color ?? '#18794A' }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="field-label">How much</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Stepper value={qty} onChange={setQty} />
            {pick ? (
              <div className="row" role="group" aria-label="Unit" style={{ gap: 8, flexWrap: 'wrap' }}>
                {units.map((u) => (
                  <button key={u} type="button" className="choice" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>
                ))}
              </div>
            ) : (
              <input aria-label="Unit" className="input" style={{ width: 140 }} value={unit} onChange={(e) => setUnit(e.target.value)} />
            )}
          </div>
        </div>

        <div>
          <div id="freq-label" className="field-label">How often</div>
          <div className="seg" role="group" aria-labelledby="freq-label" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {FREQS.map((f) => (
              <button key={f} type="button" aria-pressed={freq === f} onClick={() => setFreq(f)}>{FREQ_LABEL[f]}</button>
            ))}
          </div>
        </div>

        {weekly ? (
          <div>
            <div id="dow-label" className="field-label">On</div>
            <div role="group" aria-labelledby="dow-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
              {DOW.map((d, i) => (
                <button key={d} type="button" className="choice" aria-pressed={dow === i} onClick={() => setDow(i)} style={{ minWidth: 0, padding: 0 }}>{d}</button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="field-label" htmlFor="dom">On the</label>
            <select id="dom" className="input" value={dom} onChange={(e) => setDom(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{ordinal(d)} of the month</option>
              ))}
            </select>
          </div>
        )}

        <div className="row" style={{ gap: 10, marginTop: 4 }}>
          {repeat && (
            <button type="button" className="btn btn-danger btn-lg" onClick={remove}>
              <Icon name="trash" size={18} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={busy || !chosenName || !storeId} onClick={save}>
            {busy ? 'Saving…' : repeat ? 'Save' : 'Save repeat'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
