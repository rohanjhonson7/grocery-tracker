import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { CategoryBadge, Sheet, SheetHead, Stepper, StoreBadge } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { supabase } from '../lib/supabase';
import type { Category, ListItem } from '../lib/types';
import { fmtQty, timeAgo } from '../lib/util';
import AddItemSheet from './AddItemSheet';

export default function ListDetail() {
  const { listId } = useParams();
  const app = useApp();
  const { lists, items, categories, showHindi, live, storeById, itemInfo, toggleItem, personName } = app;
  const navigate = useNavigate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [menu, setMenu] = useState(false);

  const list = lists.find((l) => l.id === listId);
  const store = storeById(list?.store_id);
  const mine = useMemo(() => items.filter((i) => i.list_id === listId), [items, listId]);
  const toBuy = mine.filter((i) => i.status === 'to_buy');
  const bought = mine
    .filter((i) => i.status === 'bought')
    .sort((a, b) => (b.bought_at ?? '').localeCompare(a.bought_at ?? ''));
  const pct = mine.length ? Math.round((bought.length / mine.length) * 100) : 0;

  const groups = useMemo(() => {
    const other: Category = { id: 'other', name: 'Other', name_hindi: 'अन्य', icon: 'box', item_type: 'misc', sort_order: 999 };
    const byCat = new Map<string, { cat: Category; items: ListItem[] }>();
    for (const i of toBuy) {
      const cat = itemInfo(i).category ?? other;
      const g = byCat.get(cat.id) ?? { cat, items: [] };
      g.items.push(i);
      byCat.set(cat.id, g);
    }
    const order = new Map(categories.map((c) => [c.id, c.sort_order]));
    return [...byCat.values()].sort((a, b) => (order.get(a.cat.id) ?? a.cat.sort_order) - (order.get(b.cat.id) ?? b.cat.sort_order));
  }, [toBuy, itemInfo, categories]);

  if (!list) {
    return (
      <div className="screen">
        <header className="topbar compact">
          <Link to="/" className="icon-btn" aria-label="Back to lists"><Icon name="chevron-left" size={24} stroke={2.25} /></Link>
        </header>
        <p className="empty">This list isn't here any more. It may have been deleted.</p>
      </div>
    );
  }

  const clearCart = async () => {
    setMenu(false);
    const ids = bought.map((b) => b.id);
    if (!ids.length) return;
    const { error } = await supabase.from('list_items').delete().in('id', ids);
    if (error) toast(error.message);
    else {
      toast(`Cleared ${ids.length} item${ids.length === 1 ? '' : 's'} from the cart`);
      await app.refreshLists();
    }
  };

  const deleteList = async () => {
    setMenu(false);
    if (!window.confirm(`Delete the ${store?.name ?? ''} list and its ${mine.length} items?`)) return;
    const { error } = await supabase.from('grocery_lists').delete().eq('id', list.id);
    if (error) toast(error.message);
    else {
      await app.refreshLists();
      navigate('/', { replace: true });
    }
  };

  const row = (i: ListItem, done: boolean, first: boolean) => {
    const info = itemInfo(i);
    return (
      <div key={i.id} className={'item-row' + (done ? ' bought' : '')} style={{ borderTop: first ? 'none' : '1px solid var(--line-2)' }}>
        <button
          type="button"
          className="check"
          aria-label={(done ? 'Put back on list: ' : 'Mark bought: ') + info.name}
          onClick={() => toggleItem(i)}
        >
          {done ? (
            <span className="ring done"><Icon name="check" size={16} stroke={3} /></span>
          ) : (
            <span className="ring" />
          )}
        </button>
        <button type="button" className="body" onClick={() => setEditing(i)} aria-label={`Edit ${info.name}`}>
          <div className="item-name">{info.name}</div>
          {!done && showHindi && info.hindi && <div lang="hi" className="item-hi">{info.hindi}</div>}
          {!done && (info.note || info.auto) && (
            <div className="item-note row" style={{ gap: 6 }}>
              {info.auto && <span className="pill saffron-soft" style={{ padding: '2px 8px' }}><Icon name="repeat" size={11} stroke={2.5} /> Repeat</span>}
              {info.note && <span>Note: {info.note}</span>}
            </div>
          )}
          {done && (
            <div className="sub" style={{ fontSize: 12 }}>
              Bought by {personName(i.bought_by)} · {timeAgo(i.bought_at)}
            </div>
          )}
        </button>
        <span className="qty" style={done ? { background: 'none', color: 'var(--muted)', fontWeight: 600 } : undefined}>{fmtQty(i.quantity, i.unit)}</span>
      </div>
    );
  };

  return (
    <div className="screen">
      <header className="topbar compact" style={{ position: 'relative' }}>
        <Link to="/" className="icon-btn" aria-label="Back to lists"><Icon name="chevron-left" size={24} stroke={2.25} /></Link>
        <StoreBadge store={store} size={38} />
        <div className="grow" style={{ paddingLeft: 4 }}>
          <h1 className="h1 sm ellipsis">{list.name || store?.name}</h1>
          <div className="sub">{toBuy.length} to buy · {bought.length} in cart</div>
        </div>
        <button type="button" className="icon-btn" aria-label="List options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <Icon name="more" size={22} stroke={2.5} />
        </button>
        {menu && (
          <>
          <button type="button" className="menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
          <div className="menu" role="menu">
            <button type="button" role="menuitem" onClick={clearCart} disabled={!bought.length}>
              <Icon name="check" size={18} /> Clear items in the cart
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); app.setShowHindi(!showHindi); }}>
              <span lang="hi" style={{ width: 18, textAlign: 'center', fontWeight: 700 }}>अ</span> {showHindi ? 'Hide' : 'Show'} Hindi names
            </button>
            <button type="button" role="menuitem" className="danger" onClick={deleteList}>
              <Icon name="trash" size={18} /> Delete this list
            </button>
          </div>
          </>
        )}
      </header>

      <div style={{ padding: '4px 20px 8px' }} className="stack gap-10">
        <div className="progress lg" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <div className="row" style={{ gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
          <span className={'dot ' + (live ? 'live' : 'off')} aria-hidden="true" />
          {live ? 'Live · ticks sync to your household instantly' : 'Connecting… changes will sync when back online'}
        </div>
      </div>

      <main style={{ flex: 1, padding: '0 16px 20px' }}>
        {mine.length === 0 && (
          <div className="empty">
            <p style={{ margin: '0 0 12px' }}>This list is empty.</p>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} stroke={2.5} /> Add the first item
            </button>
          </div>
        )}

        {mine.length > 0 && toBuy.length === 0 && (
          <div className="row tint-green" style={{ marginTop: 14, padding: '14px 16px', color: 'var(--green-dark)' }}>
            <Icon name="circle-check" size={24} stroke={2.25} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Everything's in the cart. Tap Done shopping to finish the trip.</div>
          </div>
        )}

        {groups.map(({ cat, items: gi }) => (
          <section key={cat.id} style={{ marginTop: 16 }} aria-label={cat.name}>
            <div className="group-head">
              <CategoryBadge category={cat} />
              <h2 className="h3" style={{ fontSize: 14 }}>{cat.name}</h2>
              {showHindi && cat.name_hindi && <span lang="hi" style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>{cat.name_hindi}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{gi.length}</span>
            </div>
            <div className="card" style={{ borderRadius: 18, overflow: 'hidden' }}>
              {gi.map((i, idx) => row(i, false, idx === 0))}
            </div>
          </section>
        ))}

        {bought.length > 0 && (
          <section style={{ marginTop: 22 }} aria-label="In the cart">
            <div className="group-head">
              <span className="cat-badge" aria-hidden="true" style={{ background: 'var(--green)', color: '#FFFFFF' }}>
                <Icon name="shopping-cart" size={16} />
              </span>
              <h2 className="h3" style={{ fontSize: 14 }}>In the cart</h2>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{bought.length}</span>
            </div>
            <div className="card" style={{ borderRadius: 18, overflow: 'hidden', background: '#FBFCF9' }}>
              {bought.map((i, idx) => row(i, true, idx === 0))}
            </div>
          </section>
        )}
      </main>

      <div className="bottom-bar">
        <button type="button" className="btn btn-outline btn-lg" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} stroke={2.5} /> Add item
        </button>
        {bought.length > 0 ? (
          <Link to={`/list/${list.id}/finish`} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            Done shopping <Icon name="arrow-right" size={18} stroke={2.5} />
          </Link>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled title="Tick items as you put them in the cart">
            Done shopping
          </button>
        )}
      </div>

      {adding && <AddItemSheet initialStoreId={list.store_id} onClose={() => setAdding(false)} />}
      {editing && <EditItemSheet item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditItemSheet({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const { itemInfo, catalog, customItems, updateItem, deleteItem, showHindi } = useApp();
  const info = itemInfo(item);
  const source = item.catalog_item_id
    ? catalog.find((c) => c.id === item.catalog_item_id)
    : customItems.find((c) => c.id === item.custom_item_id);
  const units = Array.from(new Set([item.unit, source?.default_unit, ...(source?.available_units ?? [])].filter(Boolean))) as string[];
  const [qty, setQty] = useState(Number(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [note, setNote] = useState(info.note);

  const save = async () => {
    const notes = [note.trim(), info.auto ? '[Auto-added]' : ''].filter(Boolean).join(' ') || null;
    await updateItem(item.id, { quantity: qty, unit, notes });
    onClose();
  };

  return (
    <Sheet label={`Edit ${info.name}`} onClose={onClose}>
      <SheetHead onClose={onClose}>
        <div className="grow">
          <h2 className="h2">{info.name}</h2>
          {showHindi && info.hindi && <div lang="hi" className="item-hi">{info.hindi}</div>}
        </div>
      </SheetHead>
      <div className="sheet-body">
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Stepper value={qty} onChange={setQty} />
          <div className="row" role="group" aria-label="Unit" style={{ gap: 8, flexWrap: 'wrap' }}>
            {units.map((u) => (
              <button key={u} type="button" className="choice" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="edit-note">Note</label>
          <input id="edit-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, size…" />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn btn-danger btn-lg"
            onClick={async () => {
              await deleteItem(item.id);
              onClose();
            }}
          >
            <Icon name="trash" size={18} /> Remove
          </button>
          <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={save}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}
