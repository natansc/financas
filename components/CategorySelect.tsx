'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Props = {
  value: string
  onChange: (value: string) => void
  kind: 'despesa' | 'receita'
}

export default function CategorySelect({ value, onChange, kind }: Props) {
  const [cats, setCats] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get(`/api/categories?kind=${kind}`)
      .then(d => setCats(Array.isArray(d) ? d : []))
  }
  useEffect(() => { load() }, [kind])

  const createNew = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const res = await api.post('/api/categories', { name, kind, color: '#6b7280' })
    setSaving(false)
    if (res?.error) return alert(res.error)
    setNewName('')
    setAdding(false)
    await load()
    onChange(name)
  }

  return (
    <div>
      <span className="text-xs font-medium text-gray-600">Categoria</span>

      {!adding ? (
        <div className="flex gap-2">
          <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-base bg-white"
          >
            <option value="">— Selecione —</option>
            {cats.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-3 rounded-lg border border-blue-300 text-blue-600 text-sm font-medium"
            title="Nova categoria"
          >
            + Nova
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome da nova categoria"
            className="flex-1 border rounded-lg px-3 py-2 text-base"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createNew() } }}
          />
          <button
            type="button"
            onClick={createNew}
            disabled={saving}
            className="px-3 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? '...' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName('') }}
            className="px-3 rounded-lg border text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}