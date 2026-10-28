-- Run once in Supabase Dashboard > SQL Editor.
-- Auth: enable Authentication > Providers > "Allow anonymous sign-ins".

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));

create table public.unlocks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(user_id) on delete cascade,
  quest_id smallint not null check (quest_id between 1 and 6),
  created_at timestamptz not null default now(),
  unique (user_id, quest_id)
);
create index unlocks_created_at_idx on public.unlocks (created_at desc);

alter table public.profiles enable row level security;
alter table public.unlocks enable row level security;

create policy "profiles readable by all" on public.profiles
  for select using (true);
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "unlocks readable by all" on public.unlocks
  for select using (true);
create policy "insert own unlock" on public.unlocks
  for insert to authenticated with check (user_id = (select auth.uid()));

create function public.username_available(name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(name))
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

alter publication supabase_realtime add table public.unlocks;
