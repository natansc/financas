'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import TransactionForm from '@/components/TransactionForm'

export default function TransactionsPage() {
  const [txs, setTxs] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [accountId, setAccountId] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [adding, setAdding] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    if (accountId) params.set('account_id', accountId)
    if (category) params.set('category', category)
    if (type) params.set('type', type)
    api.get(`/api/transactions?${params}`).then(d => setTxs(Array.isArray(d) ? d : []))
  }

  useEffect(() => {
    api.get('/api/accounts').then(d => setAccounts(Array.isArray(d) ? d : []))
  }, [])

  useEffect(load, [month, accountId, category, type])

  const categories = Array.from(new Set(txs.map(t => t.category).filter(Boolean)))

  const remove = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return
    await api.del(`/api/transactions?id=${id}`)
    load()
  }

  const startEdit = (t: any) => {
    setAdding(false)
    setEditing(t)
  }

  const startAdd = () => {
    setEditing(null)
    setAdding(true)
  }

  const closeForm = () => {
    setEditing(null)
    setAdding(false)
  }

  const total = txs.reduce((s, t) => s + t.amount_brl, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <span className={`text-sm font-medium ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        {!adding && !editing && (
          <button
            onClick={startAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            + Novo
          </button>
        )}
      </div>

      {(adding || editing) && (
        <TransactionForm
          accounts={accounts}
          initial={editing}
          onSaved={load}
          onClose={closeForm}
        />
      )}

      <div className="space-y-2 bg-white p-3 rounded-xl shadow-sm">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />

        <select
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todas as contas</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}{a.last_four ? ` ••${a.last_four}` : ''}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
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
              <div className="flex items-center gap-2">
                {t.accounts?.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.accounts.color }} />
                )}
                <p className="font-medium truncate">{t.description}</p>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {new Date(t.purchase_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                {t.installment && t.installment !== 'Única' ? ` • ${t.installment}` : ''}
                {t.category ? ` • ${t.category}` : ''}
                {t.accounts?.name ? ` • ${t.accounts.name}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-semibold ${t.amount_brl < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {t.amount_brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => startEdit(t)} className="text-xs text-blue-500">
                  editar
                </button>
                <button onClick={() => remove(t.id)} className="text-xs text-gray-400 hover:text-red-500">
                  excluir
                </button>
              </div>
            </div>
          </li>
        ))}
        {!txs.length && (
          <p className="text-sm text-gray-500 text-center py-8">Nenhum lançamento.</p>
        )}
      </ul>
    </div>
  )
}