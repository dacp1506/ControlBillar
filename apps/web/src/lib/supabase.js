import { createSupabaseClient } from '@billar/database';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;

export const supabase = VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY
  ? createSupabaseClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  : null;
