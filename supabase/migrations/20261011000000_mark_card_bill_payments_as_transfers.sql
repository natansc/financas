alter table public.transactions
  add column if not exists is_transfer boolean not null default false;

update public.transactions t
set is_transfer = true
from public.accounts a
where t.account_id = a.id
  and a.type <> 'credit_card'
  and t.amount_brl < 0
  and (
    lower(t.description) like '%fat cartao%'
    or lower(t.description) like '%fatura de cartão%'
    or lower(t.description) like '%pagamento de fatura%'
  );
