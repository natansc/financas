'use client'

export default function DashboardCards({ transactions }: { transactions: any[] }) {
  const receitas = transactions.filter(t => t.amount_brl > 0).reduce((s, t) => s + t.amount_brl, 0)
  const despesas = transactions.filter(t => t.amount_brl < 0).reduce((s, t) => s + Math.abs(t.amount_brl), 0)
  const saldo = receitas - despesas

  const cards = [
    { label: 'Receitas', value: receitas, color: 'text-green-600' },
    { label: 'Despesas', value: despesas, color: 'text-red-600' },
    { label: 'Saldo', value: saldo, color: saldo >= 0 ? 'text-green-600' : 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-1 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>
            R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      ))}
    </div>
  )
}