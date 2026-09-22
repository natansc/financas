'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const TYPES = [
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'checking',    label: 'Conta corrente' },
  { value: 'savings',     label: 'Poupança' },
  { value: 'cash',        label: 'Dinheiro' },
  { value: 'pix',         label: 'Pix' },
  { value: 'other',       label: 'Outro' },
]

const emptyForm = {
  id: '',
  name: '',
  type: 'credit_card',
  holder: '',
  last_four: '',
  color: COLORS[0],
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState<any>(emptyForm)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.get('/api/accounts').then(d => setAccounts(Array.isArray(d) ? d : []))

  useEffect(() => { load() }, [])

  const isEdit = !!form.id
  const isCard = form.type === 'credit_card'

  const startAdd = () => { setForm(emptyForm); setOpen(true) }
  const startEdit = (a: any) => { setForm({ ...emptyForm, ...a }); setOpen(true) }
  const closeForm = () => { setForm(emptyForm); setOpen(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload: any = {
      name: form.name,
      type: form.type,
      color: form.color,
      holder: isCard ? (form.holder || null) : null,
      last_four: isCard ? (form.last_four || null) : null,
    }

    if (isEdit) {
      await api.patch('/api/accounts', { ...payload, id: form.id })
    } else {
      await api.post('/api/accounts', payload)
    }

    setSaving(false)
    closeForm()
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
        {!open && (
          <button
            onClick={startAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            + Nova
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{isEdit ? 'Editar conta' : 'Nova conta'}</h3>
            <button type="button" onClick={closeForm} className="text-sm text-gray-500">fechar</button>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Nome</span>
            <input
              placeholder="Ex: Cartão Itaú Black, Pix, Dinheiro"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Tipo</span>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base bg-white"
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {/* Só aparece pra cartão de crédito */}
          {isCard && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Titular (opcional)</span>
                <input
                  placeholder="Ex: KETTY LORRANE"
                  value={form.holder}
                  onChange={e => setForm({ ...form, holder: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-base"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Final do cartão (opcional)</span>
                <input
                  placeholder="Ex: 2094"
                  value={form.last_four}
                  onChange={e => setForm({ ...form, last_four: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-base"
                />
              </label>
            </>
          )}

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">Cor</span>
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
          </div>

          <button
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar conta'}
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
                  {TYPES.find(t => t.value === a.type)?.label}
                  {a.holder ? ` • ${a.holder}` : ''}
                  {a.last_four ? ` • ••${a.last_four}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)} className="text-xs text-blue-500">editar</button>
              <button onClick={() => remove(a.id)} className="text-xs text-gray-400 hover:text-red-500">excluir</button>
            </div>
          </li>
        ))}
        {!accounts.length && (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhuma conta cadastrada. Toque em "+ Nova".
          </p>
        )}
      </ul>
    </div>
  )
}