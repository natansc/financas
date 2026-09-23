'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type ParsedTx = {
  purchase_date: string
  description: string
  amount_brl: number
  category: string | null
  installment: string
}

type ParsedInvoice = {
  payment_date: string
  invoice_month: string
  holder: string | null
  card_last_four: string | null
  total: number | null
  transactions: ParsedTx[]
}

export default function PdfImporter() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParsedInvoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/accounts').then(d => {
      const list = Array.isArray(d) ? d : []
      setAccounts(list)
      if (list.length && !accountId) setAccountId(list[0].id)
    })
  }, [])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null); setResult(null); setSaveMsg(null)

    try {
      console.log('Enviando:', file.name, file.size)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'x-app-token': process.env.NEXT_PUBLIC_APP_TOKEN! },
        body: fd,
      })
      const json = await res.json()
      console.log('Resposta:', json)

      if (!res.ok || json.error) {
        const msg = json.hint
          ? `${json.error}\n\n${json.hint}`
          : json.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro desconhecido')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const updateTx = (idx: number, patch: Partial<ParsedTx>) => {
    if (!result) return
    const txs = [...result.transactions]
    txs[idx] = { ...txs[idx], ...patch }
    setResult({ ...result, transactions: txs })
  }

  const removeTx = (idx: number) => {
    if (!result) return
    setResult({ ...result, transactions: result.transactions.filter((_, i) => i !== idx) })
  }

  const save = async () => {
    if (!result || !accountId) return
    setSaving(true); setSaveMsg(null)

    // Formato que o endpoint /api/import espera
    const rows = result.transactions.map(t => ({
      purchase_date: t.purchase_date,
      payment_date: result.payment_date,
      invoice_month: result.invoice_month,
      description: t.description,
      category: t.category,
      amount_brl: t.amount_brl,
      installment: t.installment,
      card_name: result.holder || 'Manual',
      card_last_four: result.card_last_four || '',
      source: 'manual',
    }))

    const res = await api.post('/api/import', {
      account_id: accountId,
      invoice_month: result.invoice_month,
      rows,
    })

    setSaving(false)
    if (res?.error) {
      setSaveMsg('Erro: ' + res.error)
    } else {
      setSaveMsg(`✅ ${res.inserted} importadas • ${res.duplicates} duplicadas`)
      setResult(null)
    }
  }

  const totalBruto = result?.transactions.reduce((s, t) => s + Math.abs(t.amount_brl), 0) || 0
  const totalComSinal = result?.transactions.reduce((s, t) => s + t.amount_brl, 0) || 0

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Conta (cartão)</span>
        <select
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base bg-white"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleUpload}
          disabled={loading}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white disabled:opacity-50"
        />
      </label>

      {loading && <p className="text-sm text-gray-500">Lendo PDF...</p>}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg whitespace-pre-wrap">
          <b>Erro:</b> {error}
        </div>
      )}

      {result && (
        <>
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-1">
            <p className="text-xs text-gray-500">Fatura</p>
            <p className="font-semibold">{result.holder || 'Titular não identificado'}</p>
            <p className="text-sm">
              Vencimento: <b>{result.payment_date.split('-').reverse().join('/')}</b>
              {' '}• {result.transactions.length} lançamentos
              {' '}• Bruto: <b>R$ {totalBruto.toFixed(2)}</b>
            </p>
            <p className="text-xs text-gray-500">
              Saldo real:{' '}
              <span className={totalComSinal < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                {totalComSinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </p>
            {result.total && Math.abs(totalBruto - result.total) > 5 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Soma dos lançamentos (R$ {totalBruto.toFixed(2)}) difere do total da fatura (R$ {result.total.toFixed(2)}).
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <p className="text-xs text-gray-500 px-4 py-2 bg-gray-50">Revise antes de salvar</p>
            <ul className="divide-y divide-gray-100 max-h-96 overflow-auto">
              {result.transactions.map((t, i) => (
                <li key={i} className="p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={t.purchase_date}
                      onChange={e => updateTx(i, { purchase_date: e.target.value })}
                      className="text-xs border rounded px-2 py-1"
                    />
                    <input
                      type="text"
                      value={t.category || ''}
                      onChange={e => updateTx(i, { category: e.target.value || null })}
                      className="text-xs border rounded px-2 py-1 w-28"
                      placeholder="categoria"
                    />
                    <input
                      type="text"
                      value={t.installment}
                      onChange={e => updateTx(i, { installment: e.target.value })}
                      className="text-xs border rounded px-2 py-1 w-16"
                      placeholder="X/Y"
                    />
                    <button
                      onClick={() => removeTx(i)}
                      className="ml-auto text-xs text-red-400 hover:text-red-600"
                    >
                      excluir
                    </button>
                  </div>
                  <input
                    type="text"
                    value={t.description}
                    onChange={e => updateTx(i, { description: e.target.value })}
                    className="w-full text-sm border-0 p-0 focus:ring-0"
                  />
                  <p className={`text-sm font-semibold ${t.amount_brl < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {t.amount_brl < 0 ? '−' : '+'} R$ {Math.abs(t.amount_brl).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {saveMsg && (
            <p className={`text-sm p-3 rounded-lg ${saveMsg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {saveMsg}
            </p>
          )}

          <button
            onClick={save}
            disabled={saving || !result.transactions.length}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : `Salvar ${result.transactions.length} lançamentos`}
          </button>
        </>
      )}
    </div>
  )
}