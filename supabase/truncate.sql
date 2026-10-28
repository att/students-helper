-- Clears all participants and UNLOCKS. Run in Supabase SQL Editor.
-- Students' browsers keep their sessions and are asked for a name again on next load.
truncate table public.unlocks, public.profiles restart identity;
