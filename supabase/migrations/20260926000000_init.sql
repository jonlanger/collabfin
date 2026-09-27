-- Collabfin schema: boards shared by members, each with plans (what-if copies) of cards and links.
-- Every table has row-level security; access is decided by board membership and role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Boards and membership
-- ---------------------------------------------------------------------------
create type public.board_role as enum ('owner', 'editor', 'viewer');

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16384),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.board_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index board_members_user_idx on public.board_members (user_id);

-- Membership helpers. SECURITY DEFINER so policies can call them without recursing through RLS.
create or replace function public.board_role_of(p_board uuid)
returns public.board_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.board_members where board_id = p_board and user_id = auth.uid();
$$;

create or replace function public.can_read(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.board_members where board_id = p_board and user_id = auth.uid());
$$;

create or replace function public.can_edit(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.board_members where board_id = p_board and user_id = auth.uid() and role in ('owner', 'editor'));
$$;

create or replace function public.is_owner(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.board_members where board_id = p_board and user_id = auth.uid() and role = 'owner');
$$;

-- ---------------------------------------------------------------------------
-- Plans, cards, links, activity, invites
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  is_main boolean not null default false,
  based_on uuid references public.plans (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index plans_one_main_per_board on public.plans (board_id) where is_main;
create index plans_board_idx on public.plans (board_id);

create table public.cards (
  id uuid primary key,
  plan_id uuid not null references public.plans (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'kind' and pg_column_size(data) < 65536),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index cards_plan_idx on public.cards (plan_id);

create table public.links (
  id uuid primary key,
  plan_id uuid not null references public.plans (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  from_card uuid not null references public.cards (id) on delete cascade,
  to_card uuid not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_card <> to_card),
  unique (from_card, to_card)
);
create index links_plan_idx on public.links (plan_id);

create table public.activity (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);
create index activity_board_time_idx on public.activity (board_id, created_at desc);

create table public.board_invites (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  board_id uuid not null references public.boards (id) on delete cascade,
  role public.board_role not null default 'editor' check (role <> 'owner'),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index board_invites_board_idx on public.board_invites (board_id);

-- Keep a plan's cards and links on the same board as the plan, and cap sizes to stop runaway clients.
create or replace function public.guard_card()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.plans p where p.id = new.plan_id and p.board_id = new.board_id) then
    raise exception 'Card plan does not belong to board' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.cards where plan_id = new.plan_id) >= 500 then
    raise exception 'A plan can hold 500 cards.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger cards_guard before insert or update on public.cards for each row execute function public.guard_card();

create or replace function public.guard_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.cards c where c.id = new.from_card and c.plan_id = new.plan_id)
     or not exists (select 1 from public.cards c where c.id = new.to_card and c.plan_id = new.plan_id)
     or not exists (select 1 from public.plans p where p.id = new.plan_id and p.board_id = new.board_id) then
    raise exception 'Link cards must be on the same plan' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger links_guard before insert or update on public.links for each row execute function public.guard_link();

-- Any activity marks the board as recently updated (used to sort the boards list).
create or replace function public.touch_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.boards set updated_at = now() where id = new.board_id;
  return new;
end;
$$;
create trigger activity_touch_board after insert on public.activity for each row execute function public.touch_board();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.plans enable row level security;
alter table public.cards enable row level security;
alter table public.links enable row level security;
alter table public.activity enable row level security;
alter table public.board_invites enable row level security;

-- Profiles: yourself, and anyone you share a board with.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.board_members me join public.board_members them on me.board_id = them.board_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Boards: members read, editors update, owners delete. Boards are created through create_board().
create policy boards_select on public.boards for select to authenticated using (public.can_read(id));
create policy boards_update on public.boards for update to authenticated using (public.can_edit(id)) with check (public.can_edit(id));
create policy boards_delete on public.boards for delete to authenticated using (public.is_owner(id));

-- Members: members see each other; owners change roles and remove people; anyone can leave.
create policy members_select on public.board_members for select to authenticated using (public.can_read(board_id));
create policy members_update on public.board_members for update to authenticated using (public.is_owner(board_id)) with check (public.is_owner(board_id));
create policy members_delete on public.board_members for delete to authenticated using (public.is_owner(board_id) or user_id = auth.uid());

-- Plans: members read; editors create, rename and delete (never the main plan).
create policy plans_select on public.plans for select to authenticated using (public.can_read(board_id));
create policy plans_insert on public.plans for insert to authenticated with check (public.can_edit(board_id) and not is_main);
create policy plans_update on public.plans for update to authenticated using (public.can_edit(board_id)) with check (public.can_edit(board_id));
create policy plans_delete on public.plans for delete to authenticated using (public.can_edit(board_id) and not is_main);

-- Cards and links: members read; editors write.
create policy cards_select on public.cards for select to authenticated using (public.can_read(board_id));
create policy cards_insert on public.cards for insert to authenticated with check (public.can_edit(board_id));
create policy cards_update on public.cards for update to authenticated using (public.can_edit(board_id)) with check (public.can_edit(board_id));
create policy cards_delete on public.cards for delete to authenticated using (public.can_edit(board_id));

create policy links_select on public.links for select to authenticated using (public.can_read(board_id));
create policy links_insert on public.links for insert to authenticated with check (public.can_edit(board_id));
create policy links_delete on public.links for delete to authenticated using (public.can_edit(board_id));

-- Activity: members read; editors add entries as themselves. Entries are never edited.
create policy activity_select on public.activity for select to authenticated using (public.can_read(board_id));
create policy activity_insert on public.activity for insert to authenticated with check (public.can_edit(board_id) and user_id = auth.uid());

-- Invites: owners and editors manage them. Accepting goes through accept_invite().
create policy invites_select on public.board_invites for select to authenticated using (public.can_edit(board_id));
create policy invites_insert on public.board_invites for insert to authenticated with check (public.can_edit(board_id) and created_by = auth.uid());
create policy invites_delete on public.board_invites for delete to authenticated using (public.can_edit(board_id));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Creates a board with you as owner and its main plan, in one transaction.
create or replace function public.create_board(p_name text, p_settings jsonb default '{}'::jsonb)
returns table (board_id uuid, plan_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board uuid;
  v_plan uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a board' using errcode = '42501';
  end if;
  if (select count(*) from public.board_members where user_id = auth.uid() and role = 'owner') >= 50 then
    raise exception 'You can own up to 50 boards.' using errcode = 'P0001';
  end if;
  insert into public.boards (name, settings, created_by) values (left(trim(p_name), 60), coalesce(p_settings, '{}'::jsonb), auth.uid()) returning id into v_board;
  insert into public.board_members (board_id, user_id, role) values (v_board, auth.uid(), 'owner');
  insert into public.plans (board_id, name, is_main) values (v_board, 'Current plan', true) returning id into v_plan;
  return query select v_board, v_plan;
end;
$$;

-- Merges fields into a card. Top-level keys are replaced; a null value removes the key.
create or replace function public.patch_card(p_id uuid, p_patch jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.cards
  set data = jsonb_strip_nulls(data || p_patch)
  where id = p_id and jsonb_typeof(p_patch) = 'object';
$$;

-- Copies a plan's cards and links into a new plan, giving everything fresh ids.
create or replace function public.duplicate_plan(p_plan uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_board uuid;
  v_new uuid;
begin
  select board_id into v_board from public.plans where id = p_plan;
  if v_board is null or not public.can_edit(v_board) then
    raise exception 'You can''t copy this plan' using errcode = '42501';
  end if;
  if (select count(*) from public.plans where board_id = v_board) >= 8 then
    raise exception 'A board can have 8 plans. Delete one to add another.' using errcode = 'P0001';
  end if;
  insert into public.plans (board_id, name, based_on) values (v_board, left(trim(p_name), 40), p_plan) returning id into v_new;
  create temporary table _card_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.cards where plan_id = p_plan;
  insert into public.cards (id, plan_id, board_id, data)
    select m.new_id, v_new, v_board, c.data from public.cards c join _card_map m on m.old_id = c.id;
  insert into public.links (id, plan_id, board_id, from_card, to_card)
    select gen_random_uuid(), v_new, v_board, mf.new_id, mt.new_id
    from public.links l
    join _card_map mf on mf.old_id = l.from_card
    join _card_map mt on mt.old_id = l.to_card
    where l.plan_id = p_plan;
  return v_new;
end;
$$;

-- Joins the board an invite points to. Never lowers an existing role.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.board_invites;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept the invite' using errcode = '42501';
  end if;
  select * into v_inv from public.board_invites where token = p_token and expires_at > now();
  if v_inv.token is null then
    raise exception 'This invite link has expired or doesn''t exist.' using errcode = 'P0002';
  end if;
  insert into public.board_members (board_id, user_id, role)
  values (v_inv.board_id, auth.uid(), v_inv.role)
  on conflict (board_id, user_id) do nothing;
  return v_inv.board_id;
end;
$$;

-- Removes activity older than 90 days. Schedule with pg_cron if you like (see README).
create or replace function public.prune_activity()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.activity where created_at < now() - interval '90 days';
$$;

revoke execute on function public.prune_activity() from public, anon, authenticated;
grant execute on function public.create_board(text, jsonb) to authenticated;
grant execute on function public.patch_card(uuid, jsonb) to authenticated;
grant execute on function public.duplicate_plan(uuid, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: table changes and private board channels (presence and cursors)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.boards, public.plans, public.cards, public.links, public.activity;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create policy board_channel_read on realtime.messages for select to authenticated
  using (realtime.topic() like 'board:%' and public.can_read(public.try_uuid(split_part(realtime.topic(), ':', 2))));
create policy board_channel_write on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'board:%' and public.can_read(public.try_uuid(split_part(realtime.topic(), ':', 2))));

-- ---------------------------------------------------------------------------
-- File storage: board-files/<board id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-files', 'board-files', false, 20971520,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/csv', 'text/plain', 'text/markdown', 'application/json']
)
on conflict (id) do nothing;

create policy board_files_read on storage.objects for select to authenticated
  using (bucket_id = 'board-files' and public.can_read(public.try_uuid((storage.foldername(name))[1])));
create policy board_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'board-files' and public.can_edit(public.try_uuid((storage.foldername(name))[1])));
create policy board_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'board-files' and public.can_edit(public.try_uuid((storage.foldername(name))[1])));
