import { NextResponse } from 'next/server'
import { resolveCategory } from '@/lib/categorize'
import { getSupabaseAdmin, checkToken } from '@/lib/supabase-admin'

const normalizeText = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ')

type ImportRow = {
  purchase_date?: string
  payment_date?: string | null
  invoice_month?: string | null
  card_name?: string | null
  card_last_four?: string | null
  category?: string | null
  description?: string | null
  installment?: string | null
  amount_usd?: number | null
  exchange_rate?: number | null
  amount_brl?: number | null
  is_transfer?: boolean
}

type ImportRequest = {
  account_id?: string
  invoice_month?: string | null
  rows?: ImportRow[]
}

type ImportTransaction = {
  account_id: string
  payment_date: string
  invoice_month: string | null
  purchase_date: string
  card_name: string | null | undefined
  card_last_four: string | null | undefined
  category: string | null | undefined
  description: string
  installment: string
  amount_usd: number
  exchange_rate: number
  amount_brl: number
  is_transfer: boolean
  source: 'csv'
}

const transactionKey = (transaction: Pick<
  ImportTransaction,
  'account_id' | 'purchase_date' | 'description' | 'amount_brl' | 'installment'
>) => [
  transaction.account_id,
  transaction.purchase_date,
  normalizeText(transaction.description),
  transaction.amount_brl.toFixed(2),
  transaction.installment,
].join('|')

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { account_id, invoice_month, rows } = await req.json() as ImportRequest

  if (!account_id) return NextResponse.json({ error: 'account_id obrigatório' }, { status: 400 })
  if (!Array.isArray(rows) || !rows.length)
    return NextResponse.json({ error: 'nenhuma linha válida' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  let reassigned = 0
  let recategorized = 0

  const seen = new Set<string>()
  const payload = rows.reduce<ImportTransaction[]>((acc, r) => {
    const description = normalizeText(r.description)
    const key = [
      String(account_id),
      String(r.purchase_date ?? ''),
      String(description),
      String((Number(r.amount_brl ?? 0)).toFixed(2)),
      String(r.installment ?? 'Única'),
    ].join('|')

    if (!description || !r.purchase_date || seen.has(key)) return acc

    seen.add(key)
    acc.push({
      account_id,
      payment_date: r.payment_date || r.purchase_date,
      invoice_month: r.invoice_month || invoice_month || null,
      purchase_date: r.purchase_date,
      card_name: r.card_name,
      card_last_four: r.card_last_four,
      category: resolveCategory(r.category, description),
      description,
      installment: r.installment || 'Única',
      amount_usd: Number(r.amount_usd ?? 0),
      exchange_rate: Number(r.exchange_rate ?? 0),
      amount_brl: Number(r.amount_brl ?? 0),
      is_transfer: r.is_transfer === true,
      source: 'csv' as const,
    })
    return acc
  }, [])

  if (!payload.length) {
    return NextResponse.json({ error: 'nenhuma linha válida' }, { status: 400 })
  }

  const invoiceMonth = payload[0].invoice_month
  if (invoiceMonth && payload.every(row => row.invoice_month === invoiceMonth)) {
    const purchaseDates = payload.map(row => row.purchase_date).sort()
    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id, account_id, purchase_date, description, amount_brl, installment, invoice_month, category')
      .eq('account_id', account_id)
      .eq('source', 'csv')
      .gte('purchase_date', purchaseDates[0])
      .lte('purchase_date', purchaseDates[purchaseDates.length - 1])

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    const incomingByKey = new Map(payload.map(row => [transactionKey(row), row]))
    const matchedRows = (existing ?? []).flatMap(row => {
      const key = transactionKey({
        account_id: row.account_id,
        purchase_date: row.purchase_date,
        description: row.description,
        amount_brl: Number(row.amount_brl),
        installment: row.installment || 'Única',
      })
      const incoming = incomingByKey.get(key)
      return incoming ? [{ existing: row, incoming }] : []
    })
    const idsToRelabel = matchedRows
      .filter(({ existing }) => existing.invoice_month !== invoiceMonth)
      .map(({ existing }) => existing.id)

    if (idsToRelabel.length) {
      const { error: relabelError } = await supabase
        .from('transactions')
        .update({ invoice_month: invoiceMonth })
        .in('id', idsToRelabel)
        .eq('source', 'csv')

      if (relabelError) return NextResponse.json({ error: relabelError.message }, { status: 500 })
      reassigned = idsToRelabel.length
    }

    const autoCategories = new Set([
      'Alimentação',
      'IPVA',
      'Pet',
      'Transporte',
      'Viagem',
      'Consorcio',
      'Consórcio',
    ])
    const rowsToRecategorize = matchedRows.filter(({ existing, incoming }) =>
      existing.category !== incoming.category
      && autoCategories.has(existing.category ?? '')
      && autoCategories.has(incoming.category ?? '')
    )
    const recategorizationResults = await Promise.all(rowsToRecategorize.map(({ existing, incoming }) =>
      supabase
        .from('transactions')
        .update({ category: incoming.category })
        .eq('id', existing.id)
        .eq('source', 'csv')
        .eq('category', existing.category)
    ))
    const recategorizationError = recategorizationResults.find(result => result.error)?.error
    if (recategorizationError) {
      return NextResponse.json({ error: recategorizationError.message }, { status: 500 })
    }
    recategorized = rowsToRecategorize.length
  }

  const { data, error } = await supabase
    .from('transactions')
    .upsert(payload, {
      onConflict: 'account_id,purchase_date,description,amount_brl,installment',
      ignoreDuplicates: true,
    })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    duplicates: payload.length - (data?.length ?? 0),
    reassigned,
    recategorized,
    total: payload.length,
  })
}
