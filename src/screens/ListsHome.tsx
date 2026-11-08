import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { Sheet, SheetHead, StoreBadge, TabBar } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { daysUntil, fmtDay, fmtQty, initials } from '../lib/util';
import AddItemSheet from './AddItemSheet';

export default function ListsHome() {
  const app = useApp();
  const { household, households, profile, lists, items, stores, recurring, showHindi, catalog, storeById, itemInfo, switchHousehold } = app;
  const navigate = useNavigate();
  const toast = useToast();
  const [quick, setQuick] = useState('');
  const [adding, setAdding] = useState<{ query: string } | null>(null);
  const [newList, setNewList] = useState(false);
  const [switching, setSwitching] = useState(false);

  const cards = useMemo(() => {
    const order = new Map(stores.map((s, i) => [s.id, i]));
    return [...lists]
      .sort((a, b) => (order.get(a.store_id) ?? 99) - (order.get(b.store_id) ?? 99))
      .map((l) => {
        const its = items.filter((i) => i.list_id === l.id);
        const toBuy = its.filter((i) => i.status === 'to_buy');
        const bought = its.length - toBuy.length;
        return { list: l, store: storeById(l.store_id), toBuy, bought, total: its.length };
      });
  }, [lists, items, stores, storeById]);

  const upcoming = useMemo(
    () => recurring.filter((r) => r.is_active && r.next_add_date).slice(0, 3),
    [recurring],
  );

  const freeStores = stores.filter((s) => !lists.some((l) => l.store_id === s.id));

  const startList = async (storeId: string) => {
    try {
      const id = await app.ensureList(storeId);
      setNewList(false);
      navigate(`/list/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't start that list.");
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          {households.length > 1 ? (
            <button type="button" className="link-btn" style={{ color: 'var(--muted)', fontSize: 13, minHeight: 28, padding: 0 }} onClick={() => setSwitching(true)}>
              <span className="ellipsis">{household?.name}</span>
              <Icon name="chevron-down" size={14} stroke={2.5} />
            </button>
          ) : (
            <span className="eyebrow ellipsis" style={{ fontSize: 13, minHeight: 28, display: 'flex', alignItems: 'center' }}>{household?.name}</span>
          )}
          <h1 className="h1">Lists</h1>
        </div>
        <Link to="/family" aria-label="Household and profile" className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
          {initials(profile?.full_name)}
        </Link>
      </header>

      <form
        style={{ padding: '10px 20px 6px' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAdding({ query: quick });
          setQuick('');
        }}
      >
        <label htmlFor="quick-add" className="field-label">Quick add</label>
        <div className="searchbar">
          <Icon name="search" size={20} style={{ color: 'var(--muted)' }} />
          <input
            id="quick-add"
            autoComplete="off"
            placeholder="toor dal, दूध, paneer…"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onFocus={() => {
              if (!quick) {
                setAdding({ query: '' });
              }
            }}
          />
          <button className="icon-btn filled" aria-label="Add item">
            <Icon name="plus" size={22} stroke={2.5} />
          </button>
        </div>
      </form>

      <main className="content" style={{ paddingTop: 14 }}>
        <div className="between">
          <h2 className="h2">Shopping lists</h2>
          <button type="button" className="link-btn" onClick={() => setNewList(true)}>
            <Icon name="plus" size={16} stroke={2.5} /> New list
          </button>
        </div>

        {cards.length === 0 && (
          <div className="card empty">
            <p style={{ margin: '0 0 12px' }}>No lists yet. Start one for the store you shop at, or just add an item above.</p>
            <button type="button" className="btn btn-primary" onClick={() => setNewList(true)}>
              <Icon name="plus" size={18} stroke={2.5} /> Start a list
            </button>
          </div>
        )}

        {cards.map(({ list, store, toBuy, bought, total }) => {
          const preview = toBuy.slice(0, 4).map((i) => itemInfo(i).name.replace(/\s*\(.*\)$/, ''));
          const more = toBuy.length - preview.length;
          return (
            <Link key={list.id} to={`/list/${list.id}`} className="card card-link">
              <div className="row">
                <StoreBadge store={store} />
                <div className="grow">
                  <div style={{ fontSize: 17, fontWeight: 700 }} className="ellipsis">{list.name || store?.name || 'List'}</div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    {toBuy.length} to buy{bought ? ` · ${bought} in cart` : ''}
                  </div>
                </div>
                <Icon name="chevron-right" size={20} style={{ color: 'var(--muted)' }} />
              </div>
              {total > 0 && (
                <div className="progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((bought / total) * 100)}%` }} />
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {preview.length ? preview.join(', ') : 'Nothing to buy yet'}
                {more > 0 && <span style={{ color: 'var(--muted)' }}> +{more} more</span>}
              </div>
            </Link>
          );
        })}

        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-h" className="tint-saffron" style={{ marginTop: 6, padding: '10px 16px 6px' }}>
            <div className="between">
              <h2 id="upcoming-h" className="h3 row" style={{ gap: 8 }}>
                <Icon name="repeat" size={18} style={{ color: 'var(--saffron-ink)' }} /> Adds automatically
              </h2>
              <Link to="/repeats" className="link-btn" style={{ color: 'var(--saffron-ink)' }}>See all</Link>
            </div>
            {upcoming.map((r) => {
              const info = itemInfo(r);
              const cat = r.catalog_item_id ? catalog.find((c) => c.id === r.catalog_item_id) : undefined;
              const d = daysUntil(r.next_add_date);
              return (
                <div key={r.id} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--saffron-line)' }}>
                  <div className="grow">
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {info.name} {showHindi && cat?.name_hindi && <span lang="hi" style={{ fontWeight: 500, color: 'var(--muted)' }}>{cat.name_hindi}</span>}
                    </div>
                    <div className="sub">{fmtQty(r.quantity, r.unit)} → {storeById(r.store_id)?.name}</div>
                  </div>
                  <span className="pill saffron">{d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : fmtDay(r.next_add_date)}</span>
                </div>
              );
            })}
          </section>
        )}
      </main>

      <TabBar />

      {adding && <AddItemSheet initialQuery={adding.query} onClose={() => setAdding(null)} />}

      {newList && (
        <Sheet label="Start a list" onClose={() => setNewList(false)}>
          <SheetHead onClose={() => setNewList(false)}>
            <h2 className="h2">Start a list for…</h2>
          </SheetHead>
          <div className="sheet-body">
            {freeStores.length === 0 && <p className="empty">Every store already has a list.</p>}
            <div className="card divided">
              {freeStores.map((s) => (
                <button key={s.id} type="button" className="row" onClick={() => startList(s.id)} style={{ width: '100%', border: 'none', background: 'none', padding: '10px 14px', textAlign: 'left', minHeight: 60 }}>
                  <StoreBadge store={s} size={36} />
                  <span className="grow" style={{ fontWeight: 600 }}>{s.name}</span>
                  <Icon name="chevron-right" size={18} style={{ color: 'var(--muted)' }} />
                </button>
              ))}
            </div>
            <Link to="/family" className="link-btn" onClick={() => setNewList(false)}>
              <Icon name="plus" size={16} stroke={2.5} /> Add a store that isn't here
            </Link>
          </div>
        </Sheet>
      )}

      {switching && (
        <Sheet label="Switch household" onClose={() => setSwitching(false)}>
          <SheetHead onClose={() => setSwitching(false)}>
            <h2 className="h2">Households</h2>
          </SheetHead>
          <div className="sheet-body">
            {households.map((h) => (
              <button
                key={h.id}
                type="button"
                className={'radio-card' + (h.id === household?.id ? ' on' : '')}
                onClick={() => {
                  switchHousehold(h.id);
                  setSwitching(false);
                }}
              >
                {h.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
