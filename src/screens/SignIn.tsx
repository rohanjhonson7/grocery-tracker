import { useState } from 'react';
import type { FormEvent } from 'react';
import { APP_URL, supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'link';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() || undefined }, emailRedirectTo: APP_URL },
        });
        if (error) throw error;
        if (!data.session) setInfo('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: APP_URL, shouldCreateUser: false },
        });
        if (error) throw error;
        setInfo('We sent a sign-in link to your email. Open it on this device.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen" style={{ justifyContent: 'center' }}>
      <div className="content" style={{ flex: 'none', gap: 20, paddingTop: 40, paddingBottom: 40 }}>
        <div className="stack gap-12" style={{ alignItems: 'flex-start' }}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} style={{ borderRadius: 16 }} />
          <div>
            <h1 className="h1">Grocery Tracker</h1>
            <p className="sub" style={{ fontSize: 15, margin: '6px 0 0' }}>
              Shared shopping lists for your household, store by store.
            </p>
          </div>
        </div>

        <div className="seg" role="group" aria-label="Sign in or create account" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <button type="button" aria-pressed={mode !== 'signup'} onClick={() => setMode('signin')}>Sign in</button>
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button>
        </div>

        <form className="stack gap-14" onSubmit={submit}>
          {mode === 'signup' && (
            <div>
              <label className="field-label" htmlFor="name">Your name</label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== 'link' && (
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
          {info && <p className="notice" role="status" style={{ margin: 0 }}>{info}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Email me a link'}
          </button>
        </form>

        {mode !== 'signup' && (
          <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setMode(mode === 'link' ? 'signin' : 'link')}>
            {mode === 'link' ? 'Use my password instead' : 'Forgot your password? Email me a sign-in link'}
          </button>
        )}
      </div>
    </main>
  );
}
