'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function CategoryChart({ transactions }: { transactions: any[] }) {
  const totals: Record<string, number> = {}
  transactions
    .filter(t => t.amount_brl < 0)
    .forEach(t => {
      const c = t.category || 'Sem categoria'
      totals[c] = (totals[c] || 0) + Math.abs(t.amount_brl)
    })

  const data = Object.entries(totals)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  if (!data.length) return <p className="text-sm text-gray-500">Sem despesas nesse mês.</p>

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-3">Gastos por categoria</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + '…' : v)}
            />
            <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}