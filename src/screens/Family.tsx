import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Sheet, SheetHead, StoreBadge, Switch, TabBar } from '../components/ui';
import { useApp, useToast } from '../lib/app';
import { APP_URL, supabase } from '../lib/supabase';
import type { Household } from '../lib/types';
import { STORE_COLORS, initials } from '../lib/util';

const STORE_ICONS = ['store', 'shopping-cart', 'basket', 'warehouse', 'tag', 'building-storefront'];

export default function Family() {
  const app = useApp();
  const { household, role, members, profiles, userId, profile, stores, lists, showHindi, setShowHindi } = app;
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [hhName, setHhName] = useState(household?.name ?? '');
  const [editingMe, setEditingMe] = useState(false);
  const [myName, setMyName] = useState(profile?.full_name ?? '');
  const [addingStore, setAddingStore] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const isAdmin = role === 'admin';

  if (!household) return null;

  // Leaving is offered only while you belong to another household too.
  // As the only member (and admin) you delete it; as a regular member you leave it.
  const soleMember = members.every((m) => m.user_id === userId);
  const deletesHousehold = soleMember && isAdmin;
  const canLeave = app.households.length > 1 && (!isAdmin || soleMember);

  const joinWithCode = async (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setJoining(true);
    const { data, error } = await supabase.rpc('join_household', { p_invite_code: clean });
    setJoining(false);
    if (error) {
      toast(error.message.includes('does not match') ? "That code doesn't match a household. Check it and try again." : error.message);
      return;
    }
    const joined = data as Household;
    const already = app.households.some((h) => h.id === joined.id);
    if (!already) await app.reloadHouseholds();
    app.switchHousehold(joined.id);
    toast(already ? `You're already in ${joined.name}` : `Joined ${joined.name}`);
    setCode('');
    setJoinOpen(false);
  };

  const leave = async () => {
    const msg = deletesHousehold
      ? `Delete ${household.name}? You're its only member, so its lists, repeats and spending are deleted too.`
      : `Leave ${household.name}? You'll stop seeing its lists.`;
    if (!window.confirm(msg)) return;
    const { error } = deletesHousehold
      ? await supabase.from('households').delete().eq('id', household.id)
      : await supabase.from('household_members').delete().eq('household_id', household.id).eq('user_id', userId);
    if (error) {
      toast(error.message);
      return;
    }
    const name = household.name;
    await app.reloadHouseholds();
    toast(deletesHousehold ? `Deleted ${name}` : `Left ${name}`);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      toast('Invite code copied');
    } catch {
      toast(`Invite code: ${household.invite_code}`);
    }
  };

  const shareCode = async () => {
    const text = `Join our grocery lists on Grocery Tracker. Invite code: ${household.invite_code}\n${APP_URL}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join our household', text });
      } catch {
        /* cancelled */
      }
    } else {
      await copyCode();
    }
  };

  const saveHousehold = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('households').update({ name: hhName.trim() }).eq('id', household.id);
    if (error) toast(error.message);
    else {
      await app.reloadHouseholds();
      setRenaming(false);
    }
  };

  const saveMe = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update({ full_name: myName.trim() }).eq('id', userId);
    if (error) toast(error.message);
    else {
      await Promise.all([app.refreshProfile(), app.refreshMembers()]);
      setEditingMe(false);
    }
  };

  const deleteStore = async (id: string, name: string) => {
    const hasList = lists.some((l) => l.store_id === id);
    if (!window.confirm(`Remove ${name}?${hasList ? ' Its list and repeats will be deleted too.' : ''}`)) return;
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) toast(error.message);
    await Promise.all([app.refreshStores(), app.refreshLists(), app.refreshRecurring()]);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="h1">Family</h1>
      </header>

      <main className="content" style={{ gap: 14 }}>
        <section className="card pad stack gap-10" aria-labelledby="hh-h">
          {renaming ? (
            <form className="stack gap-10" onSubmit={saveHousehold}>
              <label className="field-label" htmlFor="hh-name">Household name</label>
              <input id="hh-name" className="input" value={hhName} onChange={(e) => setHhName(e.target.value)} autoFocus />
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setRenaming(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={!hhName.trim()}>Save</button>
              </div>
            </form>
          ) : (
            <div className="between">
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow">Household</div>
                <h2 id="hh-h" className="h2" style={{ marginTop: 2 }}>{household.name}</h2>
              </div>
              {isAdmin && <button type="button" className="link-btn" onClick={() => { setHhName(household.name); setRenaming(true); }}>Rename</button>}
            </div>
          )}
          <div className="stack divided" style={{ borderTop: '1px solid var(--line-2)' }}>
            {members.map((m) => {
              const p = profiles[m.user_id];
              const me = m.user_id === userId;
              return (
                <div key={m.id} className="row" style={{ padding: '10px 0' }}>
                  <span className="avatar" style={{ width: 40, height: 40, fontSize: 14 }} aria-hidden="true">{initials(p?.full_name)}</span>
                  <div className="grow">
                    <div style={{ fontSize: 15, fontWeight: 600 }} className="ellipsis">
                      {p?.full_name ?? 'Member'} {me && <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(you)</span>}
                    </div>
                    <div className="sub">{m.role === 'admin' ? 'Admin' : 'Member'}</div>
                  </div>
                  {me && !editingMe && (
                    <button type="button" className="icon-btn" aria-label="Edit your name" onClick={() => { setMyName(profile?.full_name ?? ''); setEditingMe(true); }}>
                      <Icon name="pencil" size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {editingMe && (
            <form className="stack gap-10" onSubmit={saveMe}>
              <label className="field-label" htmlFor="my-name">Your name</label>
              <input id="my-name" className="input" value={myName} onChange={(e) => setMyName(e.target.value)} autoFocus />
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingMe(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={!myName.trim()}>Save</button>
              </div>
            </form>
          )}
        </section>

        <section className="tint-green stack gap-12" style={{ padding: 16 }} aria-labelledby="inv-h">
          <div>
            <h2 id="inv-h" className="h3" style={{ fontSize: 16, color: '#0F3D25' }}>Shop together</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.45, color: '#23432F' }}>
              Share this code. Family who join see the same lists, repeats and spending, live.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="code-box" aria-label={`Invite code ${household.invite_code}`}>{household.invite_code}</div>
            <button type="button" className="icon-btn" aria-label="Copy invite code" onClick={copyCode} style={{ width: 52, height: 52, borderRadius: 14, background: '#FFFFFF', color: 'var(--green)' }}>
              <Icon name="copy" size={20} />
            </button>
            <button type="button" className="icon-btn filled" aria-label="Share invite" onClick={shareCode} style={{ width: 52, height: 52, borderRadius: 14 }}>
              <Icon name="share" size={20} />
            </button>
          </div>
        </section>

        <section className="card pad" aria-labelledby="join-h" style={{ paddingTop: joinOpen ? 14 : 8, paddingBottom: joinOpen ? 16 : 8 }}>
          {joinOpen ? (
            <form className="stack gap-10" onSubmit={joinWithCode}>
              <h2 id="join-h" className="h3" style={{ fontSize: 16 }}>Join with a code</h2>
              <p className="sub" style={{ margin: 0, lineHeight: 1.45 }}>
                Enter the invite code someone in your family shared. You'll see their lists, and you can switch between households from the Lists tab.
              </p>
              <label className="sr-only" htmlFor="join-code">Invite code</label>
              <input
                id="join-code"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Invite code"
                style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.12em', fontWeight: 700 }}
              />
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setJoinOpen(false); setCode(''); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={!code.trim() || joining}>{joining ? 'Joining…' : 'Join household'}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="row" onClick={() => setJoinOpen(true)} style={{ width: '100%', border: 'none', background: 'none', padding: 0, minHeight: 52, textAlign: 'left' }}>
              <span className="badge" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--green-tint)', color: 'var(--green)' }}>
                <Icon name="users" size={18} />
              </span>
              <span className="grow">
                <span id="join-h" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>Join with a code</span>
                <span className="sub">Got an invite code from family?</span>
              </span>
              <Icon name="chevron-right" size={18} style={{ color: 'var(--muted)' }} />
            </button>
          )}
        </section>

        <section className="card" aria-labelledby="st-h" style={{ padding: '6px 6px 6px 0' }}>
          <div className="between" style={{ padding: '6px 10px 4px 16px' }}>
            <h2 id="st-h" className="h3" style={{ fontSize: 16 }}>Your stores</h2>
            <button type="button" className="link-btn" onClick={() => setAddingStore(true)}>
              <Icon name="plus" size={16} stroke={2.5} /> Add store
            </button>
          </div>
          <div className="divided">
            {stores.map((s) => (
              <div key={s.id} className="row" style={{ gap: 10, padding: '8px 6px 8px 16px', minHeight: 56 }}>
                <StoreBadge store={s} size={36} />
                <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                {s.household_id ? (
                  <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => deleteStore(s.id, s.name)} style={{ color: 'var(--muted)' }}>
                    <Icon name="trash" size={18} />
                  </button>
                ) : (
                  <span className="pill grey" style={{ marginRight: 8 }}>Preset</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-label="Preferences" style={{ overflow: 'hidden' }}>
          <div className="row" style={{ padding: '6px 6px 6px 16px' }}>
            <div className="grow">
              <div style={{ fontSize: 15, fontWeight: 600 }}>Show Hindi names</div>
              <div className="sub"><span lang="hi">दूध, आटा, तूर दाल</span> under item names</div>
            </div>
            <Switch checked={showHindi} onChange={setShowHindi} label="Show Hindi names" />
          </div>
          {canLeave && (
            <div style={{ borderTop: '1px solid var(--line-2)' }}>
              <button type="button" className="row" onClick={leave} style={{ width: '100%', border: 'none', background: 'none', padding: '0 16px', minHeight: 52, fontWeight: 600, color: 'var(--danger)' }}>
                <Icon name={deletesHousehold ? 'trash' : 'logout'} size={18} />
                {deletesHousehold ? `Delete ${household.name}` : `Leave ${household.name}`}
              </button>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--line-2)' }}>
            <button type="button" className="row" onClick={() => supabase.auth.signOut()} style={{ width: '100%', border: 'none', background: 'none', padding: '0 16px', minHeight: 52, fontWeight: 600, color: 'var(--danger)' }}>
              <Icon name="logout" size={18} /> Sign out
            </button>
          </div>
        </section>
      </main>

      <TabBar />

      {addingStore && <AddStoreSheet onClose={() => setAddingStore(false)} />}
    </div>
  );
}

function AddStoreSheet({ onClose }: { onClose: () => void }) {
  const { household, stores, refreshStores } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(STORE_COLORS[0]);
  const [icon, setIcon] = useState('store');
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!household || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('stores').insert({
      household_id: household.id,
      name: name.trim(),
      color,
      icon,
      is_preset: false,
      sort_order: 100 + stores.length,
    });
    setBusy(false);
    if (error) {
      toast(error.message);
      return;
    }
    await refreshStores();
    toast(`Added ${name.trim()}`);
    onClose();
  };

  return (
    <Sheet label="Add a store" onClose={onClose}>
      <SheetHead onClose={onClose}>
        <h2 className="h2">Add a store</h2>
      </SheetHead>
      <form className="sheet-body" onSubmit={save} style={{ gap: 16 }}>
        <div className="row">
          <StoreBadge store={{ id: 'new', household_id: null, name, is_preset: false, icon, color, sort_order: 0 }} size={52} />
          <div className="grow">
            <label className="field-label" htmlFor="store-name">Store name</label>
            <input id="store-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FreshCo, Farm Boy" autoFocus />
          </div>
        </div>
        <div>
          <div className="field-label" id="color-label">Colour</div>
          <div className="row" role="group" aria-labelledby="color-label" style={{ gap: 8, flexWrap: 'wrap' }}>
            {STORE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                style={{ width: 40, height: 40, borderRadius: 12, background: c, border: color === c ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: 'inset 0 0 0 2px #FFFFFF' }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="field-label" id="icon-label">Icon</div>
          <div className="row" role="group" aria-labelledby="icon-label" style={{ gap: 8, flexWrap: 'wrap' }}>
            {STORE_ICONS.map((i) => (
              <button key={i} type="button" className="choice" aria-pressed={icon === i} aria-label={i.replace('-', ' ')} onClick={() => setIcon(i)} style={{ width: 48, padding: 0 }}>
                <Icon name={i} size={20} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy || !name.trim()}>Add store</button>
      </form>
    </Sheet>
  );
}
