import { NextResponse } from 'next/server'
import { listPluggyAccounts } from '@/lib/pluggy'
import { checkToken, getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { connection_id, pluggy_account_id, app_account_id } = await req.json()
    if (!connection_id || !pluggy_account_id || !app_account_id) {
      return NextResponse.json({ error: 'Vínculo de conta incompleto' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const [{ data: connection, error: connectionError }, { data: appAccount, error: appAccountError }] = await Promise.all([
      supabase
        .from('pluggy_connections')
        .select('id, pluggy_item_id')
        .eq('id', connection_id)
        .single(),
      supabase
        .from('accounts')
        .select('id, type')
        .eq('id', app_account_id)
        .single(),
    ])

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Conexão Pluggy não encontrada' }, { status: 404 })
    }
    if (appAccountError || !appAccount) {
      return NextResponse.json({ error: 'Conta local não encontrada' }, { status: 404 })
    }

    const pluggyAccounts = await listPluggyAccounts(connection.pluggy_item_id)
    const pluggyAccount = pluggyAccounts.find(account => account.id === pluggy_account_id)
    if (!pluggyAccount) {
      return NextResponse.json({ error: 'Conta não pertence a esta conexão Pluggy' }, { status: 400 })
    }

    const accountTypeMatches = pluggyAccount.type === 'CREDIT'
      ? appAccount.type === 'credit_card'
      : appAccount.type !== 'credit_card'
    if (!accountTypeMatches) {
      return NextResponse.json({
        error: pluggyAccount.type === 'CREDIT'
          ? 'Vincule uma conta Pluggy de crédito a um cartão cadastrado'
          : 'Vincule uma conta bancária Pluggy a uma conta que não seja cartão de crédito',
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pluggy_account_links')
      .upsert({
        pluggy_account_id: pluggyAccount.id,
        connection_id: connection.id,
        app_account_id: appAccount.id,
        pluggy_name: pluggyAccount.name,
        pluggy_type: pluggyAccount.type,
        currency_code: pluggyAccount.currencyCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'pluggy_account_id' })
      .select('pluggy_account_id, app_account_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao vincular conta'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}