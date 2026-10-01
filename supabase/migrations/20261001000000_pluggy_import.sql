alter table public.transactions
  add column if not exists pluggy_transaction_id text;

create unique index if not exists transactions_pluggy_transaction_id_uidx
  on public.transactions (pluggy_transaction_id);

create table if not exists public.pluggy_connections (
  id uuid primary key default gen_random_uuid(),
  pluggy_item_id text not null unique,
  institution_name text not null,
  status text not null default 'UPDATING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pluggy_account_links (
  pluggy_account_id text primary key,
  connection_id uuid not null references public.pluggy_connections(id) on delete cascade,
  app_account_id uuid references public.accounts(id) on delete set null,
  pluggy_name text not null,
  pluggy_type text not null check (pluggy_type in ('BANK', 'CREDIT')),
  currency_code text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pluggy_account_links_app_account_id_idx
  on public.pluggy_account_links (app_account_id);

alter table public.pluggy_connections enable row level security;
alter table public.pluggy_account_links enable row level security;