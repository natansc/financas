import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

const normalizeText = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ')

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { account_id, invoice_month, rows } = await req.json()

  if (!account_id) return NextResponse.json({ error: 'account_id obrigatório' }, { status: 400 })
  if (!Array.isArray(rows) || !rows.length)
    return NextResponse.json({ error: 'nenhuma linha válida' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  const seen = new Set<string>()
  const payload = rows.reduce((acc: any[], r: any) => {
    const description = normalizeText(r.description)
    const key = [
      String(account_id),
      String(r.purchase_date ?? ''),
      String(description),
      String((Number(r.amount_brl ?? 0)).toFixed(2)),
      String(r.installment ?? 'Única'),
    ].join('|')

    if (!description || !r.purchase_date || seen.has(key)) return acc

    seen.add(key)
    acc.push({
      account_id,
      payment_date: r.payment_date || r.purchase_date,
      invoice_month: r.invoice_month || invoice_month || null,
      purchase_date: r.purchase_date,
      card_name: r.card_name,
      card_last_four: r.card_last_four,
      category: r.category,
      description,
      installment: r.installment || 'Única',
      amount_usd: Number(r.amount_usd ?? 0),
      exchange_rate: Number(r.exchange_rate ?? 0),
      amount_brl: Number(r.amount_brl ?? 0),
      source: 'csv' as const,
    })
    return acc
  }, [])

  if (!payload.length) {
    return NextResponse.json({ error: 'nenhuma linha válida' }, { status: 400 })
  }

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
