-- Dwellness schema
-- Run this in your Supabase SQL editor

-- Spaces
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(encode(gen_random_bytes(4), 'hex')),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- Members (one row per browser per space = membership)
-- browser_id: persistent UUID stored in browser localStorage
-- user_id: nullable, reserved for future account linking (magic link / OAuth)
create table members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  browser_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  presence_state text not null default 'tbd'
    check (presence_state in ('home', 'away', 'dnd', 'tbd')),
  presence_updated_at timestamptz,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  emoji text not null default '·',
  label text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Reactions
create table reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  emoji text not null,
  created_at timestamptz not null default now()
);

-- Witnesses (seen-by indicator — one row per member per event)
create table witnesses (
  event_id   uuid not null references events(id) on delete cascade,
  member_id  uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index on witnesses(event_id);

-- Indexes
create index on members(space_id);
create index on members(browser_id);
create index on events(space_id, created_at desc);
create index on reactions(event_id);

-- Row Level Security (permissive for MVP)
alter table spaces enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table reactions enable row level security;

create policy "allow_all_spaces"    on spaces    for all using (true) with check (true);
create policy "allow_all_members"   on members   for all using (true) with check (true);
create policy "allow_all_events"    on events    for all using (true) with check (true);
create policy "allow_all_reactions" on reactions for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table reactions;

-- Upcoming (read-only display horizon, max 4h ahead)
create table upcoming (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  label      text not null,
  starts_at  timestamptz not null,
  created_at timestamptz not null default now()
);
create index on upcoming(space_id, starts_at);
alter table upcoming enable row level security;
create policy "allow_all_upcoming" on upcoming for all using (true) with check (true);
alter publication supabase_realtime add table upcoming;

-- Migrations for existing installs:
-- alter table members add column if not exists presence_updated_at timestamptz;
-- alter table spaces  add column if not exists is_public boolean not null default false;
-- alter table members add column if not exists role       text not null default 'member' check (role in ('owner', 'member'));
-- alter table members add column if not exists browser_id text;
-- alter table members add column if not exists user_id    uuid references auth.users(id) on delete set null;
-- create index if not exists members_browser_id_idx on members(browser_id);
-- update members set browser_id = gen_random_uuid()::text where browser_id is null;
-- alter table members alter column browser_id set not null;
-- create table if not exists witnesses ( event_id uuid not null references events(id) on delete cascade, member_id uuid references members(id) on delete set null, created_at timestamptz not null default now(), primary key (event_id, member_id) );
-- create table if not exists upcoming ( id uuid primary key default gen_random_uuid(), space_id uuid not null references spaces(id) on delete cascade, label text not null, starts_at timestamptz not null, created_at timestamptz not null default now() );
