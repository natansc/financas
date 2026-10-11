alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('csv', 'manual', 'pluggy', 'push'));

alter table public.transactions
  add column if not exists push_bank text
    check (push_bank in ('itau', 'nubank', 'c6', 'banco_do_brasil')),
  add column if not exists push_event_id text;

create unique index if not exists transactions_push_event_id_uidx
  on public.transactions (push_event_id)
  where push_event_id is not null;
