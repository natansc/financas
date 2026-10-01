import { NextResponse } from 'next/server'
import { resolveCategory } from '@/lib/categorize'
import { listPluggyAccounts, listPluggyBills, listPluggyTransactions } from '@/lib/pluggy'
import { checkToken, getSupabaseAdmin } from '@/lib/supabase-admin'

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

function syncStartDate(lastSyncedAt: string | null): string | undefined {
  if (!lastSyncedAt) return undefined
  const date = new Date(lastSyncedAt)
  if (Number.isNaN(date.getTime())) return undefined
  date.setUTCDate(date.getUTCDate() - 30)
  return date.toISOString().slice(0, 10)
}

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { pluggy_account_id, date_from, date_to } = await req.json()
    if (typeof pluggy_account_id !== 'string' || !pluggy_account_id) {
      return NextResponse.json({ error: 'pluggy_account_id obrigatório' }, { status: 400 })
    }
    if (Boolean(date_from) !== Boolean(date_to)) {
      return NextResponse.json({ error: 'Informe o início e o fim do período' }, { status: 400 })
    }
    if (date_from && date_to) {
      const isoDate = /^\d{4}-\d{2}-\d{2}$/
      if (!isoDate.test(date_from) || !isoDate.test(date_to)
        || Number.isNaN(Date.parse(`${date_from}T00:00:00Z`))
        || Number.isNaN(Date.parse(`${date_to}T00:00:00Z`))) {
        return NextResponse.json({ error: 'Período inválido; use datas no formato AAAA-MM-DD' }, { status: 400 })
      }
      if (date_from > date_to) {
        return NextResponse.json({ error: 'A data inicial precisa ser anterior ou igual à final' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()
    const { data: link, error: linkError } = await supabase
      .from('pluggy_account_links')
      .select('pluggy_account_id, connection_id, app_account_id, last_synced_at')
      .eq('pluggy_account_id', pluggy_account_id)
      .single()

    if (linkError || !link?.app_account_id) {
      return NextResponse.json({ error: 'Vincule esta conta Pluggy a uma conta local antes de importar' }, { status: 400 })
    }

    const [{ data: connection, error: connectionError }, { data: appAccount, error: appAccountError }] = await Promise.all([
      supabase
        .from('pluggy_connections')
        .select('pluggy_item_id')
        .eq('id', link.connection_id)
        .single(),
      supabase
        .from('accounts')
        .select('id, name, type, last_four')
        .eq('id', link.app_account_id)
        .single(),
    ])

    if (connectionError || !connection || appAccountError || !appAccount) {
      return NextResponse.json({ error: 'Não foi possível carregar o vínculo local da conta' }, { status: 404 })
    }

    const pluggyAccounts = await listPluggyAccounts(connection.pluggy_item_id)
    const pluggyAccount = pluggyAccounts.find(account => account.id === pluggy_account_id)
    if (!pluggyAccount) return NextResponse.json({ error: 'Conta não encontrada na conexão Pluggy' }, { status: 404 })

    const transactions = await listPluggyTransactions(
      pluggy_account_id,
      date_from || syncStartDate(link.last_synced_at),
      date_to || undefined
    )
    const bills = pluggyAccount.type === 'CREDIT'
      ? await listPluggyBills(pluggy_account_id).catch(() => [])
      : []
    const dueDateByBillId = new Map(bills.map(bill => [bill.id, dateOnly(bill.dueDate)]))
    const seenIds = new Set<string>()
    let ignoredPending = 0
    let ignoredForeignCurrency = 0

    const rows = transactions.flatMap(transaction => {
      if (transaction.status && transaction.status.toUpperCase() !== 'POSTED') {
        ignoredPending += 1
        return []
      }
      if (pluggyAccount.currencyCode && pluggyAccount.currencyCode !== 'BRL') {
        ignoredForeignCurrency += 1
        return []
      }
      if (!transaction.id || seenIds.has(transaction.id)) return []
      seenIds.add(transaction.id)

      const amount = transaction.amountInAccountCurrency ?? transaction.amount
      if (!Number.isFinite(amount)) return []

      const metadata = transaction.creditCardMetadata
      const purchaseDate = dateOnly(metadata?.purchaseDate) ?? dateOnly(transaction.date)
      if (!purchaseDate) return []

      const dueDate = metadata?.billId ? dueDateByBillId.get(metadata.billId) ?? null : null
      const invoiceMonth = dateOnly(metadata?.billForecastDate)?.slice(0, 7)
        ?? dueDate?.slice(0, 7)
        ?? null
      const paymentDate = pluggyAccount.type === 'CREDIT'
        ? dueDate ?? (invoiceMonth ? `${invoiceMonth}-01` : purchaseDate)
        : purchaseDate
      const description = transaction.description?.trim() || 'Movimentação bancária'
      const amountBrl = transaction.type === 'DEBIT'
        ? -Math.abs(amount)
        : transaction.type === 'CREDIT'
          ? Math.abs(amount)
          : amount
      const cardNumber = metadata?.cardNumber || pluggyAccount.number || appAccount.last_four || ''
      const totalInstallments = metadata?.totalInstallments
      const installmentNumber = metadata?.installmentNumber

      return [{
        account_id: appAccount.id,
        pluggy_transaction_id: transaction.id,
        purchase_date: purchaseDate,
        payment_date: paymentDate,
        invoice_month: invoiceMonth,
        card_name: appAccount.name,
        card_last_four: cardNumber.replace(/\D/g, '').slice(-4),
        category: resolveCategory(null, description) ?? transaction.category ?? null,
        description,
        installment: totalInstallments && installmentNumber
          ? `${installmentNumber}/${totalInstallments}`
          : 'Única',
        amount_brl: Number(amountBrl.toFixed(2)),
        source: 'pluggy',
      }]
    })

    let imported = 0
    for (let offset = 0; offset < rows.length; offset += 250) {
      const { data, error } = await supabase
        .from('transactions')
        .upsert(rows.slice(offset, offset + 250), {
          onConflict: 'pluggy_transaction_id',
          ignoreDuplicates: true,
        })
        .select('id')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      imported += data?.length ?? 0
    }

    const { error: updateError } = await supabase
      .from('pluggy_account_links')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('pluggy_account_id', pluggy_account_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({
      imported,
      duplicates: rows.length - imported,
      ignored_pending: ignoredPending,
      ignored_foreign_currency: ignoredForeignCurrency,
      total: rows.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao importar movimentações Pluggy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}