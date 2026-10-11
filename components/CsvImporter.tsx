'use client'
import { useEffect, useState } from 'react'
import Papa, { ParseResult } from 'papaparse'
import { api } from '@/lib/api'
import { resolveCategory } from '@/lib/categorize'

type CsvRow = Record<string, string>

type NormalizedRow = {
  purchase_date: string
  payment_date: string
  invoice_month: string | null
  card_name: string
  card_last_four: string
  category: string | null
  description: string
  installment: string
  amount_usd: number
  exchange_rate: number
  amount_brl: number
}

const parseDate = (s: string) => {
  if (!s) return ''
  const clean = s.trim()
  if (clean.includes('/')) {
    const [d, m, y] = clean.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return clean
}

const parseMoney = (value: string) => {
  if (!value) return 0
  const clean = value
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (!clean) return 0
  const num = Number.parseFloat(clean)
  return Number.isFinite(num) ? num : 0
}

const getField = (row: CsvRow, ...names: string[]) => {
  for (const n of names) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase())
    if (key) return row[key]
  }
  return ''
}

const normalizeC6Description = (value: string) => value.replace(/\s+/g, ' ').trim()

const matchesDataHeader = (value: string) => {
  const text = value.toLowerCase()
  return text.includes('data l') || text.includes('data de compra') || text.includes('data de pagamento')
}

const parseC6BankCsv = (rows: CsvRow[]): NormalizedRow[] => {
  return rows
    .map((r) => {
      const title = getField(r, 'Título', 'Title')
      const description = getField(r, 'Descrição', 'Descricao', 'Description')
      const rawDescription = normalizeC6Description(title || description || 'Movimentação')
      const entry = parseMoney(getField(r, 'Entrada(R$)', 'Entrada', 'Entrada (R$)'))
      const exit = parseMoney(getField(r, 'Saída(R$)', 'Saída', 'Saida (R$)'))
      const purchaseDate = parseDate(getField(r, 'Data Lançamento', 'Data Lancamento', 'Data'))
      const paymentDate = parseDate(getField(r, 'Data Contábil', 'Data Contabil'))
      const amount = entry > 0 ? entry : exit > 0 ? -exit : 0

      if (!purchaseDate || !rawDescription || !Number.isFinite(amount)) return null

      const row: NormalizedRow = {
        purchase_date: purchaseDate,
        payment_date: paymentDate || purchaseDate,
        invoice_month: null,
        card_name: 'C6 Bank',
        card_last_four: '',
        category: resolveCategory(null, rawDescription),
        description: rawDescription,
        installment: 'Única',
        amount_usd: 0,
        exchange_rate: 0,
        amount_brl: Number(amount.toFixed(2)),
      }
      return row
    })
    .filter((row): row is NormalizedRow => row !== null)
}

const parseC6InvoiceCsv = (rows: CsvRow[]): NormalizedRow[] => {
  return rows
    .map((r) => {
      const purchaseDate = parseDate(getField(r, 'Data de Compra', 'Data'))
      const description = normalizeC6Description(getField(r, 'Descrição', 'Description', 'Estabelecimento') || '')
      const categoryValue = getField(r, 'Categoria', 'Category')
      const installment = getField(r, 'Parcela', 'Installment') || 'Única'
      const amount = parseMoney(getField(r, 'Valor (em R$)', 'Valor', 'Amount'))

      if (!purchaseDate || !description || !Number.isFinite(amount)) return null

      const row: NormalizedRow = {
        purchase_date: purchaseDate,
        payment_date: purchaseDate,
        invoice_month: null,
        card_name: getField(r, 'Nome no Cartão', 'Nome', 'Titular') || 'Manual',
        card_last_four: getField(r, 'Final do Cartão', 'Final', 'Cartão') || '',
        category: resolveCategory(categoryValue && categoryValue !== '-' ? categoryValue.trim() : null, description),
        description,
        installment,
        amount_usd: 0,
        exchange_rate: 0,
        amount_brl: Number(amount.toFixed(2)),
      }
      return row
    })
    .filter((row): row is NormalizedRow => row !== null)
}

const parseGenericCsv = (rows: CsvRow[]): NormalizedRow[] => {
  return rows
    .map((r) => {
      const purchaseDate = parseDate(getField(r, 'Data de Compra', 'Data', 'Date'))
      const description = normalizeC6Description(getField(r, 'Descrição', 'Description', 'Estabelecimento') || '')
      const categoryValue = getField(r, 'Categoria', 'Category')
      const amount = parseMoney(getField(r, 'Valor (em R$)', 'Valor', 'Amount'))

      if (!purchaseDate || !description || !Number.isFinite(amount)) return null

      const row: NormalizedRow = {
        purchase_date: purchaseDate,
        payment_date: parseDate(getField(r, 'Data de Pagamento', 'Payment Date')) || purchaseDate,
        invoice_month: null,
        card_name: getField(r, 'Nome no Cartão', 'Nome', 'Titular') || 'Manual',
        card_last_four: getField(r, 'Final do Cartão', 'Final', 'Cartão') || '',
        category: resolveCategory(categoryValue && categoryValue !== '-' ? categoryValue.trim() : null, description),
        description,
        installment: getField(r, 'Parcela', 'Installment') || 'Única',
        amount_usd: parseMoney(getField(r, 'Valor (em US$)', 'Valor US$', 'USD')),
        exchange_rate: parseMoney(getField(r, 'Cotação (em R$)', 'Cotação', 'Rate')),
        amount_brl: Number(amount.toFixed(2)),
      }
      return row
    })
    .filter((row): row is NormalizedRow => row !== null)
}

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!accountId) {
      setError('Cadastre uma conta primeiro (menu Contas) e selecione aqui.')
      return
    }

    setLoading(true); setResult(null); setError(null)

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/)
      const startIndex = lines.findIndex(line => matchesDataHeader(line))
      const csvText = startIndex >= 0 ? lines.slice(startIndex).join('\n') : text
      const delimiter = csvText.includes(';') ? ';' : ','

      Papa.parse<CsvRow>(csvText, {
        header: true,
        delimiter,
        skipEmptyLines: true,
        transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
        complete: async (results: ParseResult<CsvRow>) => {
          try {
            const parsedRows = Array.isArray(results.data) ? results.data : []
            const hasC6BankHeaders = Object.keys(parsedRows[0] ?? {}).some(k =>
              matchesDataHeader(k) || k.toLowerCase().includes('entrada') || k.toLowerCase().includes('saída') || k.toLowerCase().includes('saida')
            )
            const hasC6InvoiceHeaders = Object.keys(parsedRows[0] ?? {}).some(k =>
              k.toLowerCase().includes('data de compra') || k.toLowerCase().includes('nome no cartao') || k.toLowerCase().includes('valor (em r$)')
            )

            const rows = hasC6BankHeaders
              ? parseC6BankCsv(parsedRows)
              : hasC6InvoiceHeaders
                ? parseC6InvoiceCsv(parsedRows)
                : parseGenericCsv(parsedRows)

            if (!rows.length) throw new Error('Nenhuma linha válida no CSV')

            const payload = rows.map(row => ({
              ...row,
              invoice_month: hasC6BankHeaders ? null : invoiceMonth,
              payment_date: row.payment_date || row.purchase_date,
            }))

            const res = await api.post('/api/import', {
              account_id: accountId,
              invoice_month: hasC6BankHeaders ? null : invoiceMonth,
              rows: payload,
            })

            if (res.error) throw new Error(res.error)
            setResult({ inserted: res.inserted, duplicates: res.duplicates, total: res.total })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido')
          } finally {
            setLoading(false)
            e.target.value = ''
          }
        },
        error: (err: Error) => {
          setError(err.message)
          setLoading(false)
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setLoading(false)
      e.target.value = ''
    }
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
