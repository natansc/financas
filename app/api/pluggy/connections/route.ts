import { NextResponse } from 'next/server'
import { getPluggyItem, listPluggyAccounts } from '@/lib/pluggy'
import { savePluggyConnection } from '@/lib/pluggy-sync'
import { checkToken, getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const [{ data: connections, error: connectionError }, { data: localAccounts, error: accountError }, { data: links, error: linkError }] = await Promise.all([
    supabase
      .from('pluggy_connections')
      .select('id, pluggy_item_id, institution_name, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('accounts')
      .select('id, name, type, last_four')
      .order('created_at', { ascending: true }),
    supabase
      .from('pluggy_account_links')
      .select('pluggy_account_id, app_account_id'),
  ])

  const error = connectionError || accountError || linkError
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const localAccountById = new Map((localAccounts ?? []).map(account => [account.id, account]))
  const linkedAccountByPluggyId = new Map((links ?? []).map(link => [link.pluggy_account_id, link.app_account_id]))
  const result = await Promise.all((connections ?? []).map(async connection => {
    try {
      const pluggyAccounts = await listPluggyAccounts(connection.pluggy_item_id)
      return {
        ...connection,
        accounts: pluggyAccounts.map(account => {
          const appAccountId = linkedAccountByPluggyId.get(account.id) ?? null
          return {
            ...account,
            app_account_id: appAccountId,
            app_account_name: appAccountId ? localAccountById.get(appAccountId)?.name ?? null : null,
          }
        }),
        load_error: null,
      }
    } catch (error) {
      return {
        ...connection,
        accounts: [],
        load_error: error instanceof Error ? error.message : 'Falha ao carregar contas da instituição',
      }
    }
  }))

  return NextResponse.json({ connections: result, local_accounts: localAccounts ?? [] })
}

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { item_id } = await req.json()
    if (typeof item_id !== 'string' || !item_id) {
      return NextResponse.json({ error: 'item_id obrigatório' }, { status: 400 })
    }

    const item = await getPluggyItem(item_id)
    if (item.id !== item_id) return NextResponse.json({ error: 'Conexão Pluggy inválida' }, { status: 400 })

    const result = await savePluggyConnection(getSupabaseAdmin(), item)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao salvar conexão Pluggy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}