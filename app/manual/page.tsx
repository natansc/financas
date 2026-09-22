'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function ManualPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    description: '',
    category: '',
    amount: '',
    type: 'despesa' as 'despesa' | 'receita',
    account_id: '',
  })

  useEffect(() => {
    api.get('/api/accounts').then(d => {
      const list = Array.isArray(d) ? d : []
      setAccounts(list)
      if (list.length && !form.account_id) setForm(f => ({ ...f, account_id: list[0].id }))
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.account_id) { alert('Cadastre uma conta primeiro'); return }
    setSaving(true)
    const value = parseFloat(form.amount.replace(',', '.'))
    const amount_brl = form.type === 'despesa' ? -Math.abs(value) : Math.abs(value)

    await api.post('/api/transactions', {
      account_id: form.account_id,
      purchase_date: form.purchase_date,
      description: form.description,
      category: form.category || null,
      amount_brl,
      card_name: 'Manual',
      card_last_four: '',
      source: 'manual',
    })

    setSaving(false)
    router.push('/transactions')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold">Novo lançamento</h1>

      <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm">
        {(['despesa', 'receita'] as const).map(t => (
          <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              form.type === t
                ? t === 'despesa' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                : 'text-gray-600'
            }`}>
            {t === 'despesa' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Conta</span>
        <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base bg-white" required>
          {!accounts.length && <option value="">Cadastre uma conta primeiro</option>}
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Data</span>
        <input type="date" required value={form.purchase_date}
          onChange={e => setForm({ ...form, purchase_date: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base" />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Descrição</span>
        <input type="text" required value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base" placeholder="Ex: Mercado" />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Categoria</span>
        <input type="text" value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base" placeholder="Ex: Supermercado" />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</span>
        <input type="text" inputMode="decimal" required value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base" placeholder="0,00" />
      </label>

      <button type="submit" disabled={saving || !accounts.length}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}