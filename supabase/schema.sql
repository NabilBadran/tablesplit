-- ============================================================================
-- TableSplit — Database schema  (Supabase / Postgres)
-- Mirrors Section 3 of the Developer Specification.
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.
-- Then run seed.sql to load the venue, menu and tables.
-- ============================================================================

-- Clean re-runs during development -------------------------------------------
drop table if exists payments cascade;
drop table if exists session_items cascade;
drop table if exists sessions cascade;
drop table if exists menu_items cascade;
drop table if exists tables cascade;

-- tables: every physical table in the venue ----------------------------------
create table tables (
  id   uuid primary key default gen_random_uuid(),
  name text not null                       -- e.g. "Table 4"
);

-- sessions: one open bill per table ------------------------------------------
create table sessions (
  id                     uuid primary key default gen_random_uuid(),
  table_id               uuid not null references tables(id) on delete cascade,
  status                 text not null default 'open',   -- 'open' | 'paid'
  service_charge_default numeric not null default 12.5,  -- suggested %, e.g. 10
  created_at             timestamptz not null default now()
);

-- menu_items: the restaurant's fixed menu ------------------------------------
create table menu_items (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  price    numeric not null,
  category text not null                    -- 'starter' | 'main' | 'dessert' | 'drink'
);

-- session_items: what a table actually ordered -------------------------------
create table session_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  name         text not null,              -- snapshot at order time
  price        numeric not null,           -- snapshot at order time
  qty          int not null default 1,
  claimed_qty  numeric not null default 0, -- how much has been claimed (supports split shares)
  split_count  int not null default 1,     -- ways a shared item is divided
  created_at   timestamptz not null default now()
);

-- payments: one row per diner who pays ---------------------------------------
create table payments (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references sessions(id) on delete cascade,
  item_ids              uuid[] not null default '{}',  -- session_items covered
  subtotal              numeric not null,
  service_charge_pct    numeric not null,
  service_charge_amount numeric not null,
  total                 numeric not null,
  status                text not null default 'paid',  -- 'paid'
  created_at            timestamptz not null default now()
);

create index on sessions (table_id);
create index on session_items (session_id);
create index on payments (session_id);

-- ============================================================================
-- Atomic claim helper: nudges claimed_qty by a delta, clamped to [0, qty].
-- Called from the diner UI so two phones grabbing the last unit can't push
-- claimed_qty past what was actually ordered.
-- ============================================================================
create or replace function claim_delta(p_item uuid, p_delta numeric)
returns session_items
language plpgsql
as $$
declare
  r session_items;
begin
  update session_items
     set claimed_qty = greatest(0, least(qty, claimed_qty + p_delta))
   where id = p_item
  returning * into r;
  return r;
end;
$$;

-- ============================================================================
-- Realtime: broadcast row changes so every phone stays in sync.
-- ============================================================================
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table session_items;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table tables;

-- ============================================================================
-- Row Level Security.
-- DEMO ONLY: diners are anonymous and there is no auth, so we allow the anon
-- key full access. This is appropriate for a hackathon demo, NOT production.
-- For production you would lock writes down to a service role / staff auth.
-- ============================================================================
alter table tables        enable row level security;
alter table sessions      enable row level security;
alter table menu_items    enable row level security;
alter table session_items enable row level security;
alter table payments      enable row level security;

create policy "demo all" on tables        for all using (true) with check (true);
create policy "demo all" on sessions      for all using (true) with check (true);
create policy "demo all" on menu_items    for all using (true) with check (true);
create policy "demo all" on session_items for all using (true) with check (true);
create policy "demo all" on payments      for all using (true) with check (true);
