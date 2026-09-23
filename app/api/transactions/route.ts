import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const accountId = searchParams.get('account_id')

  let q = supabase
    .from('transactions')
    .select('*, accounts(name, color, last_four)')
    .order('payment_date', { ascending: false, nullsFirst: false })
    .order('purchase_date', { ascending: false })

  if (month) {
    // Filtra por payment_date (cartão) OU purchase_date (pix/dinheiro sem payment_date)
    const [y, m] = month.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = new Date(y, m, 1).toISOString().slice(0, 10)
    q = q.or(
      `and(payment_date.gte.${start},payment_date.lt.${end}),` +
      `and(payment_date.is.null,purchase_date.gte.${start},purchase_date.lt.${end})`
    )
  }
  if (category) q = q.eq('category', category)
  if (accountId) q = q.eq('account_id', accountId)
  if (type === 'receita') q = q.gt('amount_brl', 0)
  if (type === 'despesa') q = q.lt('amount_brl', 0)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const body = await req.json()

  // Aceita um único objeto OU um array (para parcelamento)
  const items = Array.isArray(body) ? body : [body]

  const { data, error } = await supabase
    .from('transactions')
    .insert(items)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(Array.isArray(body) ? data : data?.[0])
}

export async function DELETE(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

