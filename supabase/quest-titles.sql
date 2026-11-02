-- Run once in Supabase SQL Editor. Uses the moderator passcode configured in admin.sql.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.quest_titles (
  quest_id smallint primary key check (quest_id between 1 and 6),
  title text not null check (char_length(title) between 1 and 60)
);

insert into public.quest_titles (quest_id, title) values
  (1, 'UNLOCK A QUESTION'),
  (2, 'UNLOCK A CONVERSATION'),
  (3, 'UNLOCK FEEDBACK'),
  (4, 'UNLOCK SOMEONE ELSE'),
  (5, 'UNLOCK YOUR PROFILE'),
  (6, 'UNLOCK A CONNECTION')
on conflict (quest_id) do nothing;

alter table public.quest_titles enable row level security;
drop policy if exists "quest titles readable by all" on public.quest_titles;
create policy "quest titles readable by all" on public.quest_titles
  for select using (true);
revoke insert, update, delete on public.quest_titles from anon, authenticated;
grant select on public.quest_titles to anon, authenticated;

create or replace function public.admin_update_quest_titles(passcode text, titles jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  stored_hash text;
  title_count integer;
begin
  select passcode_hash into stored_hash from public.admin_secret where id = 1;
  if stored_hash is null or passcode is null or extensions.crypt(passcode, stored_hash) <> stored_hash then
    perform pg_sleep(1);
    raise exception 'invalid passcode' using errcode = '28000';
  end if;

  if jsonb_typeof(titles) <> 'array' or jsonb_array_length(titles) <> 6 then
    raise exception 'exactly six task titles are required' using errcode = '22023';
  end if;

  select count(distinct item.quest_id)
    into title_count
    from jsonb_to_recordset(titles) as item(quest_id integer, title text)
   where item.quest_id between 1 and 6
     and char_length(trim(item.title)) between 1 and 60;

  if title_count <> 6 then
    raise exception 'invalid task titles' using errcode = '22023';
  end if;

  update public.quest_titles as target
     set title = trim(item.title)
    from jsonb_to_recordset(titles) as item(quest_id integer, title text)
   where target.quest_id = item.quest_id;
end;
$$;
revoke all on function public.admin_update_quest_titles(text, jsonb) from public;
grant execute on function public.admin_update_quest_titles(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
