import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { resolveCategory } from '@/lib/categorize'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const BANKS = ['itau', 'nubank', 'c6', 'banco_do_brasil'] as const
type Bank = (typeof BANKS)[number]

type NotificationPayload = {
  bank: Bank
  account_id: string
  event_id: string
  description: string
  amount_brl: number
  purchase_date: string
  payment_date?: string
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isPayload(value: unknown): value is NotificationPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  return typeof body.bank === 'string'
    && BANKS.includes(body.bank as Bank)
    && typeof body.account_id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.account_id)
    && typeof body.event_id === 'string'
    && body.event_id.length > 0
    && body.event_id.length <= 200
    && typeof body.description === 'string'
    && body.description.trim().length > 0
    && body.description.trim().length <= 160
    && typeof body.amount_brl === 'number'
    && Number.isFinite(body.amount_brl)
    && body.amount_brl > 0
    && body.amount_brl <= 100_000_000
    && isIsoDate(body.purchase_date)
    && (body.payment_date === undefined || isIsoDate(body.payment_date))
}

function hasValidSecret(request: Request, secret: string): boolean {
  const authorization = request.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  const secret = process.env.IOS_NOTIFICATION_WEBHOOK_SECRET
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Webhook não configurado no servidor' }, { status: 503 })
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!isPayload(body)) {
    return NextResponse.json({
      error: 'Dados inválidos; informe banco, conta, event_id, descrição, valor positivo e data da compra',
    }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, type, last_four')
      .eq('id', body.account_id)
      .maybeSingle()

    if (accountError) throw new Error(accountError.message)
    if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

    const paymentDate = body.payment_date ?? body.purchase_date
    const { data, error } = await supabase
      .from('transactions')
      .upsert({
        account_id: account.id,
        purchase_date: body.purchase_date,
        payment_date: paymentDate,
        invoice_month: account.type === 'credit_card' ? paymentDate.slice(0, 7) : null,
        card_name: account.name,
        card_last_four: account.last_four ?? '',
        category: resolveCategory(null, body.description.trim()),
        description: body.description.trim(),
        installment: 'Única',
        amount_brl: -Number(body.amount_brl.toFixed(2)),
        source: 'push',
        push_bank: body.bank,
        push_event_id: body.event_id,
      }, { onConflict: 'push_event_id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, inserted: Boolean(data), duplicate: !data })
  } catch (error) {
    console.error('Falha ao registrar compra recebida pelo webhook:', error)
    return NextResponse.json({ error: 'Falha ao salvar a compra' }, { status: 500 })
  }
}
