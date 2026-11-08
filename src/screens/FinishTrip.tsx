import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useApp, useToast } from '../lib/app';
import { supabase } from '../lib/supabase';
import type { ExpenseCategory } from '../lib/types';
import { fmtDay, fmtQty, todayISO } from '../lib/util';

const CATS: { id: ExpenseCategory; label: string }[] = [
  { id: 'grocery', label: 'Grocery' },
  { id: 'household', label: 'Household' },
  { id: 'misc', label: 'Misc' },
];

export default function FinishTrip() {
  const { listId } = useParams();
  const app = useApp();
  const { lists, items, stores, household, userId, showHindi, storeById, itemInfo, catalog } = app;
  const navigate = useNavigate();
  const toast = useToast();

  const list = lists.find((l) => l.id === listId);
  const store = storeById(list?.store_id);
  const mine = items.filter((i) => i.list_id === listId);
  const bought = mine.filter((i) => i.status === 'bought');
  const left = mine.filter((i) => i.status === 'to_buy');

  const otherStores = stores.filter((s) => s.id !== list?.store_id);
  const [leftover, setLeftover] = useState<'keep' | 'move'>('keep');
  const [moveTo, setMoveTo] = useState(() => {
    const withList = otherStores.find((s) => lists.some((l) => l.store_id === s.id));
    return (withList ?? otherStores[0])?.id ?? '';
  });
  const [amount, setAmount] = useState('');
  // Mostly cleaning/paper/personal-care items? Default the expense to Household.
  const [category, setCategory] = useState<ExpenseCategory>(() => {
    const types = bought.map((b) => (b.catalog_item_id ? catalog.find((c) => c.id === b.catalog_item_id)?.item_type : undefined) ?? 'grocery');
    const householdCount = types.filter((t) => t === 'household').length;
    return householdCount > types.length / 2 ? 'household' : 'grocery';
  });
  const [date, setDate] = useState(todayISO());
  const [saveItems, setSaveItems] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!list || !household) {
    return (
      <div className="screen">
        <header className="topbar compact">
          <Link to="/" className="icon-btn" aria-label="Back to lists"><Icon name="chevron-left" size={24} stroke={2.25} /></Link>
        </header>
        <p className="empty">This list isn't here any more.</p>
      </div>
    );
  }

  const parsed = Number(amount.replace(/[^0-9.]/g, ''));
  const hasAmount = amount.trim() !== '' && !Number.isNaN(parsed) && parsed > 0;

  const finish = async (logSpend: boolean) => {
    setBusy(true);
    const warnings: string[] = [];
    try {
      // 1. Expense (optional)
      if (logSpend && hasAmount) {
        const { data: exp, error } = await supabase
          .from('expenses')
          .insert({
            household_id: household.id,
            store_id: store?.id ?? null,
            store_name: store?.name ?? null,
            amount: Math.round(parsed * 100) / 100,
            category,
            expense_date: date,
            added_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        if (saveItems && bought.length) {
          const rows = bought.map((b) => ({
            expense_id: exp.id,
            list_item_id: b.id,
            item_name: itemInfo(b).name,
            quantity: b.quantity,
            unit: b.unit,
            price: null,
          }));
          const { error: itemsErr } = await supabase.from('expense_items').insert(rows);
          if (itemsErr) warnings.push("The spend was saved, but the item breakdown wasn't (it needs the database update).");
        }
      }

      // 2. Leftovers: keep, or move to another store's list
      if (leftover === 'move' && left.length && moveTo) {
        const target = await app.ensureList(moveTo);
        const { error } = await supabase.from('list_items').update({ list_id: target }).in('id', left.map((i) => i.id));
        if (error) throw error;
      }

      // 3. Clear what was bought; the list itself stays for next time.
      if (bought.length) {
        const { error } = await supabase.from('list_items').delete().in('id', bought.map((b) => b.id));
        if (error) throw error;
      }

      await app.refreshLists();
      toast(warnings[0] ?? (logSpend && hasAmount ? 'Trip finished and spend logged' : 'Trip finished'));
      navigate('/', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't finish the trip.");
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <header className="topbar compact">
        <Link to={`/list/${list.id}`} className="icon-btn" aria-label="Back to list"><Icon name="chevron-left" size={24} stroke={2.25} /></Link>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Finish trip</span>
      </header>

      <main className="content" style={{ gap: 14, paddingTop: 8 }}>
        <div className="row" style={{ gap: 14, padding: '4px 0 2px' }}>
          <span className="badge" aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--green)', color: '#FFFFFF', boxShadow: '0 0 0 6px #DDF0E4' }}>
            <Icon name="check" size={28} stroke={3} />
          </span>
          <div>
            <h1 className="h1" style={{ fontSize: 24 }}>{bought.length} of {mine.length} in the cart</h1>
            <div className="sub" style={{ fontSize: 14, marginTop: 3 }}>{store?.name} · {fmtDay(todayISO())}</div>
          </div>
        </div>

        {left.length > 0 && (
          <section className="card pad stack gap-10" aria-labelledby="left-h">
            <h2 id="left-h" className="h3">{left.length} still to buy</h2>
            <div className="stack divided">
              {left.map((i) => {
                const info = itemInfo(i);
                return (
                  <div key={i.id} className="between" style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {info.name} {showHindi && info.hindi && <span lang="hi" style={{ fontWeight: 500, color: 'var(--muted)' }}>{info.hindi}</span>}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtQty(i.quantity, i.unit)}</span>
                  </div>
                );
              })}
            </div>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }} className="stack gap-8">
              <legend className="sr-only">What to do with the items left</legend>
              <label className={'radio-card' + (leftover === 'keep' ? ' on' : '')}>
                <input type="radio" name="leftover" checked={leftover === 'keep'} onChange={() => setLeftover('keep')} />
                Keep them on this list for next time
              </label>
              <label className={'radio-card' + (leftover === 'move' ? ' on' : '')} style={{ paddingRight: 8 }}>
                <input type="radio" name="leftover" checked={leftover === 'move'} onChange={() => setLeftover('move')} />
                <span className="grow">Move to</span>
                <select
                  aria-label="Store to move them to"
                  className="input"
                  value={moveTo}
                  onChange={(e) => {
                    setMoveTo(e.target.value);
                    setLeftover('move');
                  }}
                  style={{ width: 'auto', height: 40, fontSize: 14, fontWeight: 700 }}
                >
                  {otherStores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </fieldset>
          </section>
        )}

        <section className="card pad stack gap-14" aria-labelledby="spend-h">
          <div className="between">
            <h2 id="spend-h" className="h3">Log what you spent</h2>
            <span className="pill grey">Optional</span>
          </div>
          <div>
            <label className="field-label" htmlFor="amount">Total paid</label>
            <div className="row" style={{ gap: 6, height: 60, padding: '0 16px', borderRadius: 16, border: '1px solid var(--field)', background: '#FBFCF9' }}>
              <span aria-hidden="true" style={{ fontSize: 26, fontWeight: 800, color: 'var(--muted)' }}>$</span>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 26, fontWeight: 800 }}
              />
            </div>
          </div>
          <div>
            <div id="cat-label" className="field-label">Category</div>
            <div className="seg" role="group" aria-labelledby="cat-label">
              {CATS.map((c) => (
                <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="date">Date</label>
            <input id="date" type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </div>
          {bought.length > 0 && (
            <label className="check-card">
              <input type="checkbox" checked={saveItems} onChange={(e) => setSaveItems(e.target.checked)} style={{ marginTop: 1 }} />
              <span>
                <strong>Save the {bought.length} bought item{bought.length === 1 ? '' : 's'} with it</strong>
                <br />
                <span className="sub" style={{ fontSize: 14 }}>So you can see what this trip included later.</span>
              </span>
            </label>
          )}
        </section>
      </main>

      <div className="bottom-bar" style={{ flexDirection: 'column', gap: 4 }}>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => finish(true)}>
          {busy ? 'Finishing…' : hasAmount ? 'Save spend and finish' : 'Finish trip'}
        </button>
        {hasAmount && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => finish(false)} style={{ color: 'var(--ink-2)' }}>
            Finish without logging spend
          </button>
        )}
      </div>
    </div>
  );
}
