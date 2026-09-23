import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const { id } = await params

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const end = new Date(y, m, 1).toISOString().slice(0, 10)

  // Filtra por payment_date (mês do vencimento)
  const { data, error } = await supabase
    .from('transactions')
    .select('description, category, amount_brl, purchase_date, payment_date, installment')
    .eq('account_id', id)
    .gte('payment_date', start)
    .lt('payment_date', end)
    .lt('amount_brl', 0)
    .order('amount_brl', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byDesc: Record<string, { total: number; count: number }> = {}
  ;(data ?? []).forEach(t => {
    const key = t.description
    if (!byDesc[key]) byDesc[key] = { total: 0, count: 0 }
    byDesc[key].total += Math.abs(t.amount_brl)
    byDesc[key].count += 1
  })

  const topStores = Object.entries(byDesc)
    .map(([name, v]) => ({ name, total: Number(v.total.toFixed(2)), count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return NextResponse.json({
    transactions: data ?? [],
    top_stores: topStores,
    month,
  })
}