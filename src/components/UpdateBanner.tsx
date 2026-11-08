import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// A phone keeps running the version it opened with (home-screen apps especially), so after
// each deploy we compare the bundle this page loaded against the one the site serves now.

const CHECK_EVERY_MS = 10 * 60 * 1000;

function bundleIn(html: string): string | null {
  return html.match(/assets\/(index-[\w-]+\.js)/)?.[1] ?? null;
}

function runningBundle(): string | null {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src;
  return src ? bundleIn(src) : null;
}

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const running = runningBundle();
    if (!import.meta.env.PROD || !running) return; // dev server has no bundle to compare
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(import.meta.env.BASE_URL, { cache: 'no-store' });
        const latest = res.ok ? bundleIn(await res.text()) : null;
        if (!stopped && latest && latest !== running) setReady(true);
      } catch {
        /* offline: try again later */
      }
    };
    const first = window.setTimeout(check, 3000);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      stopped = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);

  if (!ready || dismissed) return null;
  return (
    <div className="update-banner" role="status">
      <Icon name="refresh" size={20} style={{ flex: 'none' }} />
      <span className="grow">A new version of the app is ready.</span>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()} style={{ minHeight: 40 }}>
        Reload
      </button>
      <button type="button" className="icon-btn" aria-label="Not now" onClick={() => setDismissed(true)} style={{ color: '#FFFFFF', width: 40, height: 40 }}>
        <Icon name="x" size={18} stroke={2.25} />
      </button>
    </div>
  );
}
