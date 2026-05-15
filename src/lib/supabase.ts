import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Hard fail in dev, console-error in prod build so the user knows their
  // .env was not configured. The previous placeholder values caused silent
  // "fetch failed" errors that were very hard to debug.
  const message =
    'Supabase configuration missing. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY in your .env file. See .env.example.';
  if (import.meta.env.DEV) {
    throw new Error(message);
  }
  console.error(message);
}

export const supabase = createClient(
  supabaseUrl ?? 'http://invalid',
  supabaseAnonKey ?? 'invalid',
);
