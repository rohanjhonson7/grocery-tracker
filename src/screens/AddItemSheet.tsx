import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { CategoryBadge, Sheet, SheetHead, Stepper } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { supabase } from '../lib/supabase';
import type { Category, CustomItem, ListItem, Pickable } from '../lib/types';
import { fmtQty, pickableDefaultUnit, pickableHindi, pickableName, pickableUnits, searchItems } from '../lib/util';

const keyOf = (p: Pickable) => `${p.kind}:${p.item.id}`;

export default function AddItemSheet({
  initialStoreId,
  initialQuery = '',
  onClose,
}: {
  initialStoreId?: string;
  initialQuery?: string;
  onClose: () => void;
}) {
  const { stores, lists, items, catalog, customItems, categories, household, showHindi, addItem, refreshCustom } = useApp();
  const toast = useToast();
  const [storeId, setStoreId] = useState(initialStoreId ?? lists[0]?.store_id ?? stores[0]?.id ?? '');
  // Show the store you came from first, then stores that already have a list, then the rest.
  const [firstStore] = useState(storeId);
  const storeChips = useMemo(() => {
    const rank = (id: string) => (id === firstStore ? 0 : lists.some((l) => l.store_id === id) ? 1 : 2);
    return [...stores].sort((a, b) => rank(a.id) - rank(b.id));
  }, [stores, lists, firstStore]);
  const [query, setQuery] = useState(initialQuery);
  const [browseCat, setBrowseCat] = useState<Category | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const store = stores.find((s) => s.id === storeId);
  const listId = lists.find((l) => l.store_id === storeId)?.id;

  // What's already waiting on this store's list, by catalog/custom id.
  const onList = useMemo(() => {
    const m = new Map<string, ListItem>();
    for (const i of items) {
      if (i.list_id !== listId || i.status !== 'to_buy') continue;
      if (i.catalog_item_id) m.set('catalog:' + i.catalog_item_id, i);
      if (i.custom_item_id) m.set('custom:' + i.custom_item_id, i);
    }
    return m;
  }, [items, listId]);

  const results: Pickable[] = useMemo(() => {
    if (query.trim()) return searchItems(query, catalog, customItems);
    if (browseCat) {
      return [
        ...customItems.filter((c) => c.category_id === browseCat.id).map((item) => ({ kind: 'custom' as const, item })),
        ...catalog.filter((c) => c.category_id === browseCat.id).map((item) => ({ kind: 'catalog' as const, item })),
      ];
    }
    return customItems.slice(0, 8).map((item) => ({ kind: 'custom' as const, item }));
  }, [query, browseCat, catalog, customItems]);

  const exact = results.some((p) => pickableName(p).toLowerCase() === query.trim().toLowerCase());

  const select = (p: Pickable | 'new') => {
    const k = p === 'new' ? 'new' : keyOf(p);
    if (selected === k) {
      setSelected(null);
      return;
    }
    setSelected(k);
    setQty(1);
    setNote('');
    setUnit(p === 'new' ? 'piece' : pickableDefaultUnit(p));
    setNewCat(browseCat?.id ?? '');
  };

  const reset = () => {
    setSelected(null);
    setQuery('');
    setBrowseCat(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const add = async (p: Pickable) => {
    if (!storeId) return;
    setBusy(true);
    try {
      await addItem({ storeId, pick: p, quantity: qty, unit: unit || 'piece', notes: note });
      toast(`Added ${pickableName(p)} to ${store?.name ?? 'list'}`);
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setBusy(false);
    }
  };

  const addCustom = async (e: FormEvent) => {
    e.preventDefault();
    if (!household) return;
    const name = query.trim();
    if (!name) return;
    setBusy(true);
    const cat = categories.find((c) => c.id === newCat);
    const u = unit.trim() || 'piece';
    const { data, error } = await supabase
      .from('custom_items')
      .insert({
        household_id: household.id,
        name,
        category_id: cat?.id ?? null,
        item_type: cat?.item_type ?? 'grocery',
        default_unit: u,
        available_units: [u],
      })
      .select()
      .single();
    if (error) {
      setBusy(false);
      toast(error.message);
      return;
    }
    await refreshCustom();
    await add({ kind: 'custom', item: data as CustomItem });
  };

  const renderSelected = (p: Pickable) => {
    const units = pickableUnits(p);
    const suggested = p.kind === 'catalog' ? p.item.suggested_stores ?? [] : [];
    const category = categories.find((c) => c.id === p.item.category_id) ?? null;
    return (
      <div className="result selected" key={keyOf(p)}>
        <button type="button" className="row" onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', alignItems: 'flex-start' }}>
          <div className="grow">
            <div style={{ fontSize: 16, fontWeight: 700 }}>{pickableName(p)}</div>
            {showHindi && pickableHindi(p) && <div lang="hi" className="item-hi">{pickableHindi(p)}</div>}
          </div>
          {category && <span className="pill grey">{category.name}</span>}
        </button>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Stepper value={qty} onChange={setQty} />
          <div className="row" role="group" aria-label="Unit" style={{ gap: 8, flexWrap: 'wrap' }}>
            {units.map((u) => (
              <button key={u} type="button" className="choice" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
        </div>
        {suggested.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Usually at</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {suggested.map((name) => {
                const s = stores.find((x) => x.name === name);
                if (!s) return null;
                return (
                  <button key={s.id} type="button" className="store-chip" aria-pressed={s.id === storeId} onClick={() => setStoreId(s.id)}>
                    <span className="swatch" style={{ background: s.color ?? '#18794A' }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="item-note">Note (optional)</label>
          <input id="item-note" className="input" placeholder='Brand, size, "the yellow bag"…' value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary btn-lg" disabled={busy || !storeId} onClick={() => add(p)}>
          <Icon name="plus" size={18} stroke={2.5} />
          Add {fmtQty(qty, unit || 'piece')} to {store?.name ?? 'list'}
        </button>
      </div>
    );
  };

  return (
    <Sheet label="Add item" onClose={onClose} tall>
      <SheetHead onClose={onClose}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Add to</span>
      </SheetHead>

      <div style={{ padding: '0 20px 4px', flex: 'none' }}>
        <div role="group" aria-label="Store" className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {storeChips.map((s) => (
            <button key={s.id} type="button" className="store-chip" aria-pressed={s.id === storeId} onClick={() => setStoreId(s.id)} style={{ flex: 'none' }}>
              <span className="swatch" style={{ background: s.color ?? '#18794A' }} />
              {s.name}
            </button>
          ))}
        </div>
        <form
          className="searchbar"
          style={{ marginTop: 8, background: 'var(--bg)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) select(results[0]);
          }}
        >
          <Icon name="search" size={20} style={{ color: 'var(--muted)' }} />
          <label htmlFor="item-search" className="sr-only">Search items</label>
          <input
            id="item-search"
            ref={inputRef}
            autoFocus
            autoComplete="off"
            placeholder="Search: dal, दूध, paneer…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
          />
          {(query || browseCat) && (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={reset} style={{ color: 'var(--muted)' }}>
              <Icon name="circle-x" size={18} />
            </button>
          )}
        </form>
        {query.trim() && (
          <p className="sub" style={{ margin: '8px 2px 0', fontSize: 12 }}>
            {results.length} {results.length === 1 ? 'match' : 'matches'} · searches English, <span lang="hi">हिन्दी</span> and other names
          </p>
        )}
        {!query.trim() && browseCat && (
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button type="button" className="link-btn" onClick={() => setBrowseCat(null)}>
              <Icon name="chevron-left" size={16} stroke={2.5} /> All categories
            </button>
          </div>
        )}
      </div>

      <div className="sheet-body" style={{ gap: 6, paddingLeft: 16, paddingRight: 16 }}>
        {!query.trim() && !browseCat && customItems.length > 0 && <h3 className="caps" style={{ margin: '4px 4px 2px' }}>Your items</h3>}

        {results.map((p) => {
          const k = keyOf(p);
          if (selected === k) return renderSelected(p);
          const existing = onList.get(k);
          return (
            <button type="button" key={k} className="result" onClick={() => select(p)}>
              <div className="grow">
                <div className="item-name">{pickableName(p)}</div>
                {showHindi && pickableHindi(p) && <div lang="hi" className="item-hi">{pickableHindi(p)}</div>}
              </div>
              {existing ? (
                <span className="pill green">
                  <Icon name="check" size={13} stroke={3} />
                  On list · {fmtQty(existing.quantity, existing.unit)}
                </span>
              ) : (
                <span className="icon-btn soft" aria-hidden="true">
                  <Icon name="plus" size={20} stroke={2.5} />
                </span>
              )}
            </button>
          );
        })}

        {!query.trim() && !browseCat && (
          <>
            <h3 className="caps" style={{ margin: '10px 4px 4px' }}>Browse the catalog</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {categories.map((c) => (
                <button key={c.id} type="button" className="card row" onClick={() => setBrowseCat(c)} style={{ padding: '10px 12px', gap: 10, textAlign: 'left', minHeight: 56 }}>
                  <CategoryBadge category={c} />
                  <span className="grow" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                    {c.name}
                    {showHindi && c.name_hindi && <span lang="hi" className="item-hi" style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{c.name_hindi}</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {query.trim() && !exact && (
          selected === 'new' ? (
            <form className="result selected" onSubmit={addCustom}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>New item: “{query.trim()}”</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                <Stepper value={qty} onChange={setQty} />
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label className="sr-only" htmlFor="new-unit">Unit</label>
                  <input id="new-unit" className="input" placeholder="Unit (kg, packet…)" value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="new-cat">Category</label>
                <select id="new-cat" className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                  <option value="">Other / not sure</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="new-note">Note (optional)</label>
                <input id="new-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-lg" disabled={busy || !storeId}>
                <Icon name="plus" size={18} stroke={2.5} /> Save and add to {store?.name ?? 'list'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="row"
              onClick={() => select('new')}
              style={{ marginTop: 4, minHeight: 56, borderRadius: 16, border: '1.5px dashed #B9C5B3', background: '#FBFCF9', padding: '8px 14px', textAlign: 'left' }}
            >
              <span className="badge" aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--green-tint)', color: 'var(--green)' }}>
                <Icon name="plus" size={18} stroke={2.5} />
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.35 }}>
                <strong>Not here? Add “{query.trim()}” as your own item.</strong>
                <br />
                <span className="sub" style={{ fontSize: 14 }}>It'll show up first next time.</span>
              </span>
            </button>
          )
        )}
      </div>
    </Sheet>
  );
}
