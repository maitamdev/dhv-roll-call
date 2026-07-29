import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.');
}

// Preserve one browser auth client across Fast Refresh. Multiple GoTrueClient
// instances sharing the same storage key can race during development.
const browserGlobal = globalThis as typeof globalThis & {
  __dhvSupabaseBrowser?: SupabaseClient;
};
export const supabase = browserGlobal.__dhvSupabaseBrowser
  ?? createBrowserClient(supabaseUrl, supabaseAnonKey, { isSingleton: true });
if (typeof window !== 'undefined') {
  browserGlobal.__dhvSupabaseBrowser = supabase;
}

// Client for server-side API routes with administrative privileges
if (!supabaseServiceKey && process.env.NODE_ENV === 'production') {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured in production.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});
