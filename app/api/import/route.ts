import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'


export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  

  const { account_id, invoice_month, rows } = await req.json()

  if (!account_id) return NextResponse.json({ error: 'account_id obrigatório' }, { status: 400 })
  if (!Array.isArray(rows) || !rows.length)
    return NextResponse.json({ error: 'nenhuma linha válida' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  const payload = rows.map((r: any) => ({
    account_id,
    payment_date: r.payment_date || r.purchase_date,   // ← novo
    invoice_month: r.invoice_month || null,
    purchase_date: r.purchase_date,
    card_name: r.card_name,
    card_last_four: r.card_last_four,
    category: r.category,
    description: r.description,
    installment: r.installment,
    amount_usd: r.amount_usd,
    exchange_rate: r.exchange_rate,
    amount_brl: r.amount_brl,
    source: 'csv' as const,
  }))

  const { data, error } = await supabase
    .from('transactions')
    .upsert(payload, {
      onConflict: 'account_id,purchase_date,description,amount_brl,installment',
      ignoreDuplicates: true,
    })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    duplicates: payload.length - (data?.length ?? 0),
    total: payload.length,
  })
}