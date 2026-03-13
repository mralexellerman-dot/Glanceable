-- Dwellness MVP schema
-- Run this in your Supabase SQL editor

-- Spaces
create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(encode(gen_random_bytes(4), 'hex')),
  created_at timestamptz not null default now()
);

-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  display_name text not null,
  presence_state text not null default 'tbd'
    check (presence_state in ('home', 'away', 'dnd', 'tbd')),
  created_at timestamptz not null default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  emoji text not null default '📌',
  label text not null,
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

-- Indexes
create index on members(space_id);
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
