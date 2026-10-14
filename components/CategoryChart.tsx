'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { isC6CardRefund } from '@/lib/transaction-classification'

type CategoryTransaction = {
  id: string
  amount_brl: number
  source?: string | null
  category?: string | null
  is_transfer?: boolean
  purchase_date: string
  description: string
  accounts?: { name?: string | null; type?: string | null } | null
}

export default function CategoryChart({ transactions }: { transactions: CategoryTransaction[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const totals: Record<string, number> = {}
  const includedTransactions = transactions.filter(t => !t.is_transfer && (
    t.amount_brl < 0
    || isC6CardRefund(t)
  ))
  includedTransactions.forEach(t => {
    const c = t.category || 'Sem categoria'
    totals[c] = (totals[c] || 0) - t.amount_brl
  })

  const data = Object.entries(totals)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .filter(category => category.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  if (!data.length) return <p className="text-sm text-gray-500">Sem despesas nesse mês.</p>

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
  const selectedTransactions = selectedCategory
    ? includedTransactions
      .filter(t => (t.category || 'Sem categoria') === selectedCategory)
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))
    : []
  const selectedTotal = selectedTransactions.reduce((sum, transaction) => sum - transaction.amount_brl, 0)

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
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry: unknown) => {
                if (typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string') {
                  const categoryName = entry.name
                  setSelectedCategory(current => current === categoryName ? null : categoryName)
                }
              }}
            >
              {data.map((category, i) => (
                <Cell
                  key={category.name}
                  fill={COLORS[i % COLORS.length]}
                  opacity={selectedCategory && selectedCategory !== category.name ? 0.45 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {selectedCategory && (
        <section className="mt-4 border-t pt-4" aria-live="polite">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold">{selectedCategory}</h3>
              <p className="text-xs text-gray-500">
                {selectedTransactions.length} lançamentos • Total líquido {selectedTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Fechar
            </button>
          </div>
          <ul className="divide-y max-h-72 overflow-y-auto">
            {selectedTransactions.map(transaction => (
              <li key={transaction.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{transaction.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(`${transaction.purchase_date}T00:00:00`).toLocaleDateString('pt-BR')}
                    {transaction.accounts?.name ? ` • ${transaction.accounts.name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={transaction.amount_brl > 0 ? 'font-medium text-blue-600' : 'font-medium text-red-600'}>
                    {transaction.amount_brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {isC6CardRefund(transaction) && (
                    <p className="text-xs text-blue-600">Crédito no cartão</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
