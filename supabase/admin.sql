-- Run once in Supabase SQL Editor (safe to re-run). Replace CHANGE-ME with the moderator passcode first.

-- Lets students un-mark a task they marked by mistake.
drop policy if exists "delete own unlock" on public.unlocks;
create policy "delete own unlock" on public.unlocks
  for delete to authenticated using (user_id = (select auth.uid()));

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_secret (
  id int primary key default 1 check (id = 1),
  passcode_hash text not null
);
alter table public.admin_secret enable row level security; -- no policies: not readable through the API
revoke all on public.admin_secret from anon, authenticated;

insert into public.admin_secret (passcode_hash)
values (extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create or replace function public.admin_reset(passcode text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare h text;
begin
  select passcode_hash into h from public.admin_secret where id = 1;
  if h is null or passcode is null or extensions.crypt(passcode, h) <> h then
    perform pg_sleep(1);
    raise exception 'invalid passcode' using errcode = '28000';
  end if;
  truncate table public.unlocks, public.profiles restart identity;
end;
$$;
revoke all on function public.admin_reset(text) from public;
grant execute on function public.admin_reset(text) to anon, authenticated;

notify pgrst, 'reload schema';
