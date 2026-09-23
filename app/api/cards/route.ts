import { NextResponse } from 'next/server'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') || '6', 10)

  const { data: accounts, error: errAcc } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'credit_card')
    .order('name')
  if (errAcc) return NextResponse.json({ error: errAcc.message }, { status: 500 })

  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)

  const { data: txs, error: errTx } = await supabase
    .from('transactions')
    .select('account_id, purchase_date, amount_brl, category')
    .in('account_id', accounts?.map(a => a.id) || [])
    .gte('purchase_date', since.toISOString().slice(0, 10))
    .lt('amount_brl', 0)

  if (errTx) return NextResponse.json({ error: errTx.message }, { status: 500 })

  // Lista dos meses no range (ordem cronológica)
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

    const monthly = monthKeys.map(m => {
      const total = accTxs
        .filter(t => t.purchase_date.startsWith(m))
        .reduce((s, t) => s + Math.abs(t.amount_brl), 0)
      return { month: m, total: Number(total.toFixed(2)) }
    })

    // Descobre o mês mais recente COM dados nesse cartão
    const monthsWithData = monthly.filter(m => m.total > 0)
    const lastMonthWithData = monthsWithData[monthsWithData.length - 1] || null
    const prevMonthWithData = monthsWithData[monthsWithData.length - 2] || null

    const currentMonth = lastMonthWithData?.month || null
    const currentTotal = lastMonthWithData?.total || 0
    const prevTotal = prevMonthWithData?.total || 0

    // Top categorias do último mês com dados
    const catTotals: Record<string, number> = {}
    if (currentMonth) {
      accTxs
        .filter(t => t.purchase_date.startsWith(currentMonth))
        .forEach(t => {
          const c = t.category || 'Sem categoria'
          catTotals[c] = (catTotals[c] || 0) + Math.abs(t.amount_brl)
        })
    }
    const topCategories = Object.entries(catTotals)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    const limit = Number(acc.limit_brl || 0)
    const usedPct = limit > 0 ? (currentTotal / limit) * 100 : 0

    return {
      id: acc.id,
      name: acc.name,
      color: acc.color || '#3b82f6',
      last_four: acc.last_four,
      limit_brl: limit,
      current_month: currentMonth,
      current_total: currentTotal,
      prev_total: prevTotal,
      variation_pct: prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0,
      limit_used_pct: usedPct,
      monthly,
      top_categories: topCategories,
    }
  })

  // Último mês global (pra usar de default nos detalhes)
  const allMonthsWithData = cards
    .map(c => c.current_month)
    .filter(Boolean)
    .sort()
  const globalCurrentMonth = allMonthsWithData[allMonthsWithData.length - 1] || new Date().toISOString().slice(0, 7)

  return NextResponse.json({ cards, current_month: globalCurrentMonth })
}