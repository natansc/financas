import { NextResponse } from 'next/server'
import { listPluggyItems } from '@/lib/pluggy'
import { savePluggyConnection } from '@/lib/pluggy-sync'
import { checkToken, getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const items = await listPluggyItems()
    const supabase = getSupabaseAdmin()
    let accountsLinked = 0

    for (const item of items) {
      const result = await savePluggyConnection(supabase, item)
      accountsLinked += result.accounts_added_or_linked
    }

    return NextResponse.json({ connections: items.length, accounts_linked: accountsLinked })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar conexões existentes na Pluggy'
    const hint = message.includes('403')
      ? 'A Pluggy precisa habilitar a listagem de itens (GET /v2/items) para esta aplicação.'
      : undefined
    return NextResponse.json({ error: message, hint }, { status: 502 })
  }
}