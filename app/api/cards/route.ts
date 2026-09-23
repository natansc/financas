import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') || '6', 10)

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = searchParams.get('month') || defaultMonth

  const { data: accounts, error: errAcc } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'credit_card')
    .order('name')
  if (errAcc) return NextResponse.json({ error: errAcc.message }, { status: 500 })

  // since = 1º dia do mês mais antigo do range
  const since = new Date()
  since.setDate(1)
  since.setMonth(since.getMonth() - (months - 1))
  const sinceIso = since.toISOString().slice(0, 10)

  // Busca transações pela payment_date (cartão é sempre no vencimento)
  const { data: txs, error: errTx } = await supabase
    .from('transactions')
    .select('account_id, payment_date, purchase_date, amount_brl, category')
    .in('account_id', accounts?.map(a => a.id) || [])
    .gte('payment_date', sinceIso)
    .lt('amount_brl', 0)

  if (errTx) return NextResponse.json({ error: errTx.message }, { status: 500 })

  // Meses do range (cronológico)
  const monthKeys: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d)
    m.setMonth(m.getMonth() - i)
    monthKeys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }

  const cards = (accounts ?? []).map(acc => {
    const accTxs = (txs ?? []).filter(t => t.account_id === acc.id)

    // Agrupa por payment_date (o mês que o dinheiro sai)
    const monthly = monthKeys.map(m => {
      const total = accTxs
        .filter(t => (t.payment_date || t.purchase_date).startsWith(m))
        .reduce((s, t) => s + Math.abs(t.amount_brl), 0)
      return { month: m, total: Number(total.toFixed(2)) }
    })

    const selectedIdx = monthKeys.indexOf(selectedMonth)
    const selectedTotal = selectedIdx >= 0 ? monthly[selectedIdx].total : 0
    const prevTotal = selectedIdx > 0 ? monthly[selectedIdx - 1].total : 0

    // Top categorias do mês selecionado
    const catTotals: Record<string, number> = {}
    accTxs
      .filter(t => (t.payment_date || t.purchase_date).startsWith(selectedMonth))
      .forEach(t => {
        const c = t.category || 'Sem categoria'
        catTotals[c] = (catTotals[c] || 0) + Math.abs(t.amount_brl)
      })
    const topCategories = Object.entries(catTotals)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    const limit = Number(acc.limit_brl || 0)
    const usedPct = limit > 0 ? (selectedTotal / limit) * 100 : 0

    return {
      id: acc.id,
      name: acc.name,
      color: acc.color || '#3b82f6',
      last_four: acc.last_four,
      limit_brl: limit,
      current_total: selectedTotal,
      prev_total: prevTotal,
      variation_pct: prevTotal > 0 ? ((selectedTotal - prevTotal) / prevTotal) * 100 : 0,
      limit_used_pct: usedPct,
      monthly,
      top_categories: topCategories,
    }
  })

  // Meses disponíveis
  const monthsWithData = new Set<string>()
  ;(txs ?? []).forEach(t => {
    const ref = t.payment_date || t.purchase_date
    if (ref) monthsWithData.add(ref.slice(0, 7))
  })

  return NextResponse.json({
    cards,
    selected_month: selectedMonth,
    months_with_data: Array.from(monthsWithData).sort().reverse(),
  })
}