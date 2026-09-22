'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280']

const KINDS = [
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
  { value: 'ambos',   label: 'Ambos' },
]

const emptyForm = { id: '', name: '', kind: 'despesa', color: COLORS[0] }

export default function CategoriesPage() {
  const [cats, setCats] = useState<any[]>([])
  const [form, setForm] = useState<any>(emptyForm)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'todos' | 'despesa' | 'receita'>('todos')

  const load = () => api.get('/api/categories').then(d => setCats(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const isEdit = !!form.id
  const startAdd = () => { setForm(emptyForm); setOpen(true) }
  const startEdit = (c: any) => { setForm({ ...emptyForm, ...c }); setOpen(true) }
  const closeForm = () => { setForm(emptyForm); setOpen(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await api.patch('/api/categories', form)
      } else {
        const { id, ...create } = form
        const res = await api.post('/api/categories', create)
        if (res?.error) throw new Error(res.error)
      }
      closeForm()
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar esta categoria? Lançamentos antigos mantêm o texto salvo.')) return
    await api.del(`/api/categories?id=${id}`)
    load()
  }

  const visible = filter === 'todos'
    ? cats
    : cats.filter(c => c.kind === filter || c.kind === 'ambos')

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Categorias</h1>
        {!open && (
          <button onClick={startAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
            + Nova
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{isEdit ? 'Editar categoria' : 'Nova categoria'}</h3>
            <button type="button" onClick={closeForm} className="text-sm text-gray-500">fechar</button>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Nome</span>
            <input
              placeholder="Ex: Alimentação"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Tipo</span>
            <select
              value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base bg-white"
            >
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">Cor</span>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    form.color === c ? 'border-gray-900' : 'border-transparent'
                  }`} style={{ background: c }} />
              ))}
            </div>
          </div>

          <button disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </form>
      )}

      <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm">
        {(['todos','despesa','receita'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'text-gray-600'
            }`}>
            {f === 'todos' ? 'Todas' : f === 'despesa' ? 'Despesas' : 'Receitas'}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visible.map(c => (
          <li key={c.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-gray-500">
                  {KINDS.find(k => k.value === c.kind)?.label}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(c)} className="text-xs text-blue-500">editar</button>
              <button onClick={() => remove(c.id)} className="text-xs text-gray-400 hover:text-red-500">excluir</button>
            </div>
          </li>
        ))}
        {!visible.length && (
          <p className="text-sm text-gray-500 text-center py-8">Nenhuma categoria nesse filtro.</p>
        )}
      </ul>
    </div>
  )
}