import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID = 'ulxrslukflzdswqjvczt';
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'sb_publishable_-zkqCQnkVf1BfQa4LhU64A_KMMOdUpo';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_PUBLISHABLE_KEY.length > 20
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
