import { createClient } from "@supabase/supabase-js";

// The anon key is public by design; access is enforced by RLS (see supabase/schema.sql).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
