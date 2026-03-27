import { createClient } from '@supabase/supabase-js';

let supabaseUrl: string;
let supabaseAnonKey: string;

if (typeof window !== 'undefined') {
  // Client-side
  supabaseUrl = window.ENV?.SUPABASE_URL || '';
  supabaseAnonKey = window.ENV?.SUPABASE_ANON_KEY || '';
} else {
  // Server-side
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (Supabase Dashboard → Project Settings → API). Restart the dev server after saving.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
