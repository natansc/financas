'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'credit_card',
    holder: '',
    last_four: '',
    color: COLORS[0],
  })

  const load = () => api.get('/api/accounts').then(d => setAccounts(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post('/api/accounts', form)
    setForm({ name: '', type: 'credit_card', holder: '', last_four: '', color: COLORS[0] })
    setShowForm(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar esta conta e TODAS as transações dela?')) return
    await api.del(`/api/accounts?id=${id}`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg"
        >
          {showForm ? 'Cancelar' : '+ Nova'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <input
            placeholder="Nome (ex: Cartão Ketty 2094)"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          >
            <option value="credit_card">Cartão de crédito</option>
            <option value="checking">Conta corrente</option>
            <option value="savings">Poupança</option>
            <option value="cash">Dinheiro</option>
          </select>
          <input
            placeholder="Titular (ex: KETTY LORRANE)"
            value={form.holder}
            onChange={e => setForm({ ...form, holder: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
          <input
            placeholder="Final do cartão (ex: 2094)"
            value={form.last_four}
            onChange={e => setForm({ ...form, last_four: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={`w-8 h-8 rounded-full border-2 ${
                  form.color === c ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">
            Salvar conta
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {accounts.map(a => (
          <li key={a.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: a.color }} />
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.holder}{a.last_four ? ` • ••${a.last_four}` : ''}
                </p>
              </div>
            </div>
            <button onClick={() => remove(a.id)} className="text-xs text-gray-400 hover:text-red-500">
              excluir
            </button>
          </li>
        ))}
        {!accounts.length && (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhuma conta cadastrada. Adicione a primeira.
          </p>
        )}
      </ul>
    </div>
  )
}