'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function ManualPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    description: '',
    category: '',
    amount: '',
    type: 'despesa' as 'despesa' | 'receita',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const value = parseFloat(form.amount.replace(',', '.'))
    const amount_brl = form.type === 'despesa' ? -Math.abs(value) : Math.abs(value)

    await api.post('/api/transactions', {
      purchase_date: form.purchase_date,
      description: form.description,
      category: form.category || null,
      amount_brl,
      card_name: 'Manual',
      card_last_four: '0000',
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
          <button
            key={t}
            type="button"
            onClick={() => setForm({ ...form, type: t })}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              form.type === t
                ? t === 'despesa'
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
                : 'text-gray-600'
            }`}
          >
            {t === 'despesa' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      <Field label="Data">
        <input
          type="date"
          required
          value={form.purchase_date}
          onChange={e => setForm({ ...form, purchase_date: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Descrição">
        <input
          type="text"
          required
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="input"
          placeholder="Ex: Mercado"
        />
      </Field>

      <Field label="Categoria">
        <input
          type="text"
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          className="input"
          placeholder="Ex: Supermercado"
        />
      </Field>

      <Field label="Valor (R$)">
        <input
          type="text"
          inputMode="decimal"
          required
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          className="input"
          placeholder="0,00"
        />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          background: white;
          font-size: 16px;
        }
      `}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}