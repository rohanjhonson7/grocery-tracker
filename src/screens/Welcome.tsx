import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { firstName } from '../lib/util';

export default function Welcome() {
  const { profile, reloadHouseholds } = useApp();
  const [name, setName] = useState(() => (profile?.full_name ? `${firstName(profile.full_name)}'s Household` : 'Our Household'));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('create');
    setError(null);
    const { error } = await supabase.rpc('create_household', { p_name: name.trim() || 'Our Household' });
    if (error) setError(error.message);
    else await reloadHouseholds();
    setBusy(null);
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('join');
    setError(null);
    const { error } = await supabase.rpc('join_household', { p_invite_code: code.trim() });
    if (error) {
      setError(
        error.code === 'PGRST202'
          ? 'Joining by code needs the database update (supabase/migrations). Ask the household admin.'
          : error.message,
      );
    } else await reloadHouseholds();
    setBusy(null);
  };

  return (
    <main className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Welcome{profile?.full_name ? `, ${firstName(profile.full_name)}` : ''}</div>
          <h1 className="h1" style={{ marginTop: 4 }}>Set up your household</h1>
        </div>
        <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <div className="content" style={{ gap: 16 }}>
        <p className="sub" style={{ fontSize: 15, margin: 0 }}>Lists, repeats and spending are shared by everyone in a household.</p>

        <form className="card pad stack gap-12" onSubmit={join} style={{ background: 'var(--green-tint)', border: 'none' }}>
          <h2 className="h3">Join your family</h2>
          <div>
            <label className="field-label" htmlFor="code">Invite code</label>
            <input
              id="code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.12em', fontWeight: 700 }}
            />
          </div>
          <button className="btn btn-primary btn-lg" disabled={!code.trim() || busy !== null}>{busy === 'join' ? 'Joining…' : 'Join household'}</button>
        </form>

        <form className="card pad stack gap-12" onSubmit={create}>
          <h2 className="h3">Or start a new one</h2>
          <div>
            <label className="field-label" htmlFor="hh-name">Household name</label>
            <input id="hh-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-lg" disabled={busy !== null}>{busy === 'create' ? 'Creating…' : 'Create household'}</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
