update public.transactions
set category = 'Transporte'
where lower(trim(coalesce(category, ''))) in ('ipva', 'consorcio', 'consórcio')
   or description ~* '(^|[^[:alnum:]])(ipva|cons[oó]rcio)([^[:alnum:]]|$)';
