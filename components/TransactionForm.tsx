'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Account = { id: string; name: string; last_four?: string | null }

type Props = {
  accounts: Account[]
  initial?: any | null      // se vier com id, é edição
  onSaved: () => void       // chamado após sucesso (recarrega lista)
  onClose: () => void       // fecha o form
}

export default function TransactionForm({ accounts, initial, onSaved, onClose }: Props) {
  const isEdit = !!initial?.id

  const buildForm = () => ({
    id: initial?.id,
    account_id: initial?.account_id || accounts[0]?.id || '',
    purchase_date: initial?.purchase_date || new Date().toISOString().slice(0, 10),
    description: initial?.description || '',
    category: initial?.category || '',
    amount:
      initial?.amount_brl !== undefined
        ? Math.abs(initial.amount_brl).toFixed(2).replace('.', ',')
        : '',
    type:
      initial?.amount_brl !== undefined
        ? (initial.amount_brl >= 0 ? 'receita' : 'despesa')
        : 'despesa',
    installment: initial?.installment || 'Única',
  })

  const [form, setForm] = useState<any>(buildForm())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!form.account_id && accounts[0]) {
      setForm((f: any) => ({ ...f, account_id: accounts[0].id }))
    }
  }, [accounts])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.account_id) return alert('Cadastre uma conta primeiro')

    const value = parseFloat(String(form.amount).replace(/\./g, '').replace(',', '.'))
    if (isNaN(value)) return alert('Valor inválido')

    setSaving(true)
    setFeedback(null)

    const amount_brl = form.type === 'despesa' ? -Math.abs(value) : Math.abs(value)
    const payload: any = {
      account_id: form.account_id,
      purchase_date: form.purchase_date,
      description: form.description,
      category: form.category || null,
      amount_brl,
      installment: form.installment || 'Única',
      card_name: 'Manual',
      card_last_four: '',
      source: 'manual',
    }

    let res
    if (isEdit) {
      res = await api.patch('/api/transactions', { ...payload, id: form.id })
    } else {
      res = await api.post('/api/transactions', payload)
    }

    setSaving(false)

    if (res?.error) {
      setFeedback('Erro: ' + res.error)
      return
    }

    onSaved()

    if (isEdit) {
      onClose()
    } else {
      // Mantém a conta e a data (que costumam se repetir) e limpa o resto
      setForm((f: any) => ({
        ...f,
        description: '',
        category: '',
        amount: '',
        installment: 'Única',
      }))
      setFeedback('✓ Adicionado. Pode lançar outro.')
      setTimeout(() => setFeedback(null), 2000)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h3>
        <button type="button" onClick={onClose} className="text-sm text-gray-500">fechar</button>
      </div>

      <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
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

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Conta</span>
        <select
          value={form.account_id}
          onChange={e => setForm({ ...form, account_id: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base bg-white"
          required
        >
          {!accounts.length && <option value="">Cadastre uma conta primeiro</option>}
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Data</span>
          <input
            type="date"
            required
            value={form.purchase_date}
            onChange={e => setForm({ ...form, purchase_date: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Valor (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
            placeholder="0,00"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Descrição</span>
        <input
          type="text"
          required
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base"
          placeholder="Ex: Mercado"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Categoria</span>
          <input
            type="text"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
            placeholder="Ex: Mercado"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Parcela</span>
          <input
            type="text"
            value={form.installment}
            onChange={e => setForm({ ...form, installment: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
            placeholder="Única"
          />
        </label>
      </div>

      {feedback && (
        <p className={`text-sm ${feedback.startsWith('Erro') ? 'text-red-600' : 'text-green-600'}`}>
          {feedback}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !accounts.length}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar'}
      </button>
    </form>
  )
}