'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function TransactionsPage() {
  const [txs, setTxs] = useState<any[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')

  const load = () => {
    const params = new URLSearchParams({ month })
    if (category) params.set('category', category)
    if (type) params.set('type', type)
    api.get(`/api/transactions?${params}`).then(d => setTxs(Array.isArray(d) ? d : []))
  }

  useEffect(load, [month, category, type])

  const categories = Array.from(new Set(txs.map(t => t.category).filter(Boolean)))

  const remove = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return
    await api.del(`/api/transactions?id=${id}`)
    setTxs(txs.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lançamentos</h1>

      <div className="space-y-2 bg-white p-3 rounded-xl shadow-sm">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tudo</option>
          <option value="despesa">Só despesas</option>
          <option value="receita">Só receitas</option>
        </select>
      </div>

      <ul className="space-y-2">
        {txs.map(t => (
          <li key={t.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{t.description}</p>
              <p className="text-xs text-gray-500 truncate">
                {new Date(t.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                {t.category ? ` • ${t.category}` : ''}
                {t.card_last_four ? ` • ••${t.card_last_four}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-semibold ${t.amount_brl < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {t.amount_brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <button
                onClick={() => remove(t.id)}
                className="text-xs text-gray-400 hover:text-red-500 mt-1"
              >
                excluir
              </button>
            </div>
          </li>
        ))}
        {!txs.length && <p className="text-sm text-gray-500 text-center py-8">Nenhum lançamento.</p>}
      </ul>
    </div>
  )
}