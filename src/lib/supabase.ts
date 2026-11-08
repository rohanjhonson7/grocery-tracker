import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.');
}

/** Where the app lives, e.g. https://rohanjhonson7.github.io/grocery-tracker/ (used in links and email redirects). */
export const APP_URL = window.location.origin + import.meta.env.BASE_URL;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
