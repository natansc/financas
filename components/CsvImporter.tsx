'use client'
import { useEffect, useState } from 'react'
import Papa, { ParseResult } from 'papaparse'
import { api } from '@/lib/api'

type CsvRow = Record<string, string>

export default function CsvImporter() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; duplicates: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get('/api/accounts').then(d => {
      const list = Array.isArray(d) ? d : []
      setAccounts(list)
      if (list.length) setAccountId(list[0].id)
    })
  }, [])

  const parseDate = (s: string) => {
    if (!s) return ''
    const clean = s.trim()
    // aceita "19/06/2026" ou "2026-06-19"
    if (clean.includes('/')) {
      const [d, m, y] = clean.split('/')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return clean
  }

  const parseMoney = (s: string) =>
    parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0

  const getField = (row: CsvRow, ...names: string[]) => {
    for (const n of names) {
      const key = Object.keys(row).find(k => k.trim() === n)
      if (key) return row[key]
    }
    return ''
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!accountId) {
      setError('Cadastre uma conta primeiro (menu Contas) e selecione aqui.')
      return
    }

    setLoading(true); setResult(null); setError(null)

    Papa.parse<CsvRow>(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      // 🔑 ESTA LINHA RESOLVE O PROBLEMA DA DATA (remove BOM e espaços)
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: async (results: ParseResult<CsvRow>) => {
        try {
          const rows = results.data
            .map((r) => ({
              purchase_date: parseDate(getField(r, 'Data de Compra', 'Data', 'Date')),
              card_name: getField(r, 'Nome no Cartão', 'Nome', 'Titular') || 'Manual',
              card_last_four: getField(r, 'Final do Cartão', 'Final', 'Cartão') || '',
              category: (() => {
                const c = getField(r, 'Categoria', 'Category')
                return c && c !== '-' ? c.trim() : null
              })(),
              description: getField(r, 'Descrição', 'Description', 'Estabelecimento') || '',
              installment: getField(r, 'Parcela', 'Installment') || 'Única',
              amount_usd: parseMoney(getField(r, 'Valor (em US$)', 'Valor US$', 'USD')),
              exchange_rate: parseMoney(getField(r, 'Cotação (em R$)', 'Cotação', 'Rate')),
              amount_brl: parseMoney(getField(r, 'Valor (em R$)', 'Valor', 'Amount')),
            }))
            .filter(r => r.description && r.purchase_date && !isNaN(r.amount_brl))

          if (!rows.length) throw new Error('Nenhuma linha válida no CSV')

          const res = await api.post('/api/import', {
            account_id: accountId,
            invoice_month: invoiceMonth,
            rows,
          })

          if (res.error) throw new Error(res.error)
          setResult({ inserted: res.inserted, duplicates: res.duplicates, total: res.total })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro desconhecido')
        } finally {
          setLoading(false)
          e.target.value = '' // permite reenviar o mesmo arquivo
        }
      },
      error: (err: Error) => { setError(err.message); setLoading(false) },
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Conta</span>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base bg-white"
          >
            {!accounts.length && <option value="">Nenhuma conta cadastrada</option>}
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.last_four ? ` • ••${a.last_four}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Mês da fatura</span>
          <input
            type="month"
            value={invoiceMonth}
            onChange={e => setInvoiceMonth(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </label>
      </div>

      <label className="block">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleUpload}
          disabled={loading || !accountId}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white disabled:opacity-50"
        />
      </label>

      {loading && <p className="text-sm text-gray-500">Processando...</p>}

      {result && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✅ {result.inserted} importadas • {result.duplicates} duplicadas ignoradas (de {result.total})
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">Erro: {error}</div>
      )}
    </div>
  )
}