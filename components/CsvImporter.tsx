'use client'
import { useEffect, useState } from 'react'
import Papa, { ParseResult } from 'papaparse'
import { api } from '@/lib/api'
import { resolveCategory } from '@/lib/categorize'

type CsvRow = Record<string, string>
type ImportAccount = { id: string; name: string; type: string; last_four?: string | null }

const isImportAccount = (value: unknown): value is ImportAccount =>
  typeof value === 'object'
  && value !== null
  && 'id' in value
  && typeof value.id === 'string'
  && 'name' in value
  && typeof value.name === 'string'
  && 'type' in value
  && typeof value.type === 'string'

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
  is_transfer: boolean
}

const parseDate = (s: string) => {
  if (!s) return ''
  const clean = s.trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/')
    const isoDate = `${y}-${m}-${d}`
    const date = new Date(`${isoDate}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === isoDate ? isoDate : ''
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return ''
  const date = new Date(`${clean}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === clean ? clean : ''
}

const parseMoney = (value: string) => {
  if (!value) return 0
  let clean = value
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
  const isParenthesizedNegative = clean.startsWith('(') && clean.endsWith(')')
  clean = clean.replace(/[()]/g, '').replace(/[^\d,.-]/g, '')
  if (!clean) return 0

  const commaIndex = clean.lastIndexOf(',')
  const periodIndex = clean.lastIndexOf('.')
  if (commaIndex >= 0 && periodIndex >= 0) {
    clean = commaIndex > periodIndex
      ? clean.replace(/\./g, '').replace(',', '.')
      : clean.replace(/,/g, '')
  } else if (commaIndex >= 0) {
    clean = clean.replace(',', '.')
  }

  const amount = Number(clean)
  if (!Number.isFinite(amount)) return Number.NaN
  return isParenthesizedNegative ? -Math.abs(amount) : amount
}

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

const getField = (row: CsvRow, ...names: string[]) => {
  for (const n of names) {
    const key = Object.keys(row).find(k => normalizeHeader(k) === normalizeHeader(n))
    if (key) return row[key]
  }
  return ''
}

const normalizeC6Description = (value: string) => value.replace(/\s+/g, ' ').trim()
const isCardBillPayment = (value: string) => {
  const text = normalizeHeader(value)
  return text.includes('fat cartao')
    || text.includes('fatura de cartao')
    || text.includes('pagamento de fatura')
}

const matchesDataHeader = (value: string) => {
  const text = normalizeHeader(value)
  return text.includes('data lanc') || text.includes('data de compra') || text.includes('data de pagamento')
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

      if (!purchaseDate || !rawDescription || !Number.isFinite(amount) || amount === 0) return null

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
        is_transfer: isCardBillPayment(`${title} ${description}`),
      }
      return row
    })
    .filter((row): row is NormalizedRow => row !== null)
}

const parseC6InvoiceCsv = (rows: CsvRow[], invoiceMonth: string): NormalizedRow[] => {
  return rows
    .map((r) => {
      const purchaseDate = parseDate(getField(r, 'Data de Compra', 'Data'))
      const description = normalizeC6Description(getField(r, 'Descrição', 'Description', 'Estabelecimento') || '')
      const categoryValue = getField(r, 'Categoria', 'Category')
      const installment = getField(r, 'Parcela', 'Installment') || 'Única'
      const amount = parseMoney(getField(r, 'Valor (em R$)'))

      if (!purchaseDate || !description || !Number.isFinite(amount) || amount === 0) return null

      const row: NormalizedRow = {
        purchase_date: purchaseDate,
        payment_date: `${invoiceMonth}-08`,
        invoice_month: invoiceMonth,
        card_name: getField(r, 'Nome no Cartão', 'Nome', 'Titular') || 'Manual',
        card_last_four: getField(r, 'Final do Cartão', 'Final', 'Cartão') || '',
        category: resolveCategory(categoryValue && categoryValue !== '-' ? categoryValue.trim() : null, description),
        description,
        installment,
        amount_usd: 0,
        exchange_rate: 0,
        amount_brl: Number((-Math.abs(amount)).toFixed(2)),
        is_transfer: false,
      }
      return row
    })
    .filter((row): row is NormalizedRow => row !== null)
}

type CsvImporterProps = { mode: 'invoice' | 'statement' }

export default function CsvImporter({ mode }: CsvImporterProps) {
  const [accounts, setAccounts] = useState<ImportAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; duplicates: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eligibleAccounts = accounts.filter(account =>
    mode === 'invoice' ? account.type === 'credit_card' : account.type !== 'credit_card'
  )

  useEffect(() => {
    api.get('/api/accounts').then(d => {
      const list = Array.isArray(d) ? d.filter(isImportAccount) : []
      setAccounts(list)
      const eligible = list.filter(account =>
        mode === 'invoice' ? account.type === 'credit_card' : account.type !== 'credit_card'
      )
      if (eligible.length) setAccountId(eligible[0].id)
    })
  }, [mode])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const account = eligibleAccounts.find(item => item.id === accountId)
    if (!account) {
      setError(mode === 'invoice'
        ? 'Cadastre ou selecione um cartão de crédito antes de importar a fatura.'
        : 'Cadastre ou selecione uma conta bancária antes de importar o extrato.')
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
            if (results.errors.length) {
              throw new Error(`Não foi possível ler o CSV: ${results.errors[0].message}`)
            }

            const headers = Object.keys(parsedRows[0] ?? {}).map(normalizeHeader)
            const hasC6BankHeaders = headers.some(k => k.includes('data lanc'))
              && headers.some(k => k.includes('entrada'))
              && headers.some(k => k.includes('saida'))
            const hasC6InvoiceHeaders = headers.some(k => k.includes('data de compra'))
              && headers.some(k => k.includes('valor (em r$)'))
              && headers.some(k => k === 'descricao')

            const expectedFormat = mode === 'invoice' ? hasC6InvoiceHeaders : hasC6BankHeaders
            if (!expectedFormat) {
              throw new Error(mode === 'invoice'
                ? 'Arquivo incompatível. Selecione o CSV da fatura do cartão C6 (Data de Compra, Descrição e Valor em R$).'
                : 'Arquivo incompatível. Selecione o CSV do extrato bancário C6 (Data Lançamento, Entrada e Saída).')
            }

            const rows = mode === 'invoice'
              ? parseC6InvoiceCsv(parsedRows, invoiceMonth)
              : parseC6BankCsv(parsedRows)

            if (!rows.length) {
              throw new Error(mode === 'invoice'
                ? 'Nenhuma compra válida encontrada na fatura. Confira data, descrição e valor em reais.'
                : 'Nenhuma movimentação válida encontrada no extrato. Confira data, descrição e entrada ou saída.')
            }

            const payload = rows.map(row => ({
              ...row,
              card_name: mode === 'statement' ? account.name : row.card_name,
              card_last_four: mode === 'statement' ? '' : row.card_last_four,
              invoice_month: mode === 'invoice' ? invoiceMonth : null,
              payment_date: row.payment_date || row.purchase_date,
            }))

            const res = await api.post('/api/import', {
              account_id: accountId,
              invoice_month: mode === 'invoice' ? invoiceMonth : null,
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
            {!eligibleAccounts.length && (
              <option value="">
                {mode === 'invoice' ? 'Nenhum cartão de crédito cadastrado' : 'Nenhuma conta bancária cadastrada'}
              </option>
            )}
            {eligibleAccounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.last_four ? ` • ••${a.last_four}` : ''}
              </option>
            ))}
          </select>
        </label>

        {mode === 'invoice' && (
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Mês da fatura</span>
            <input
              type="month"
              value={invoiceMonth}
              onChange={e => setInvoiceMonth(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="block text-sm text-gray-600 mb-2">
          {mode === 'invoice'
            ? 'Importe somente o CSV da fatura do cartão C6. Todos os lançamentos serão registrados como despesas no cartão.'
            : 'Importe somente o CSV de movimentações da conta C6. Entradas ficam positivas e saídas, como Pix e pagamento de fatura, ficam negativas.'}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleUpload}
          disabled={loading || !accountId || !eligibleAccounts.length}
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
