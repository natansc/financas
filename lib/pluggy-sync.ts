import type { SupabaseClient } from '@supabase/supabase-js'
import { listPluggyAccounts, type PluggyAccount, type PluggyItem } from '@/lib/pluggy'

type LocalAccount = {
  id: string
  name: string
  type: string
  last_four: string | null
}

function accountType(account: PluggyAccount): string {
  if (account.type === 'CREDIT') return 'credit_card'
  if (account.subtype?.includes('SAVINGS')) return 'savings'
  if (account.subtype?.includes('CHECKING')) return 'checking'
  return 'other'
}

function lastFour(account: PluggyAccount): string | null {
  const digits = account.number?.replace(/\D/g, '') || ''
  return digits ? digits.slice(-4) : null
}

function normalizedName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function findMatchingAccount(
  pluggyAccount: PluggyAccount,
  localAccounts: LocalAccount[],
  linkedAccountId: string | null
): LocalAccount | undefined {
  if (linkedAccountId) {
    const existing = localAccounts.find(account => account.id === linkedAccountId)
    if (existing) return existing
  }

  const compatible = localAccounts.filter(account => account.type === accountType(pluggyAccount))
  const remoteLastFour = lastFour(pluggyAccount)
  if (remoteLastFour) {
    const byLastFour = compatible.filter(account => account.last_four === remoteLastFour)
    if (byLastFour.length === 1) return byLastFour[0]
  }

  const byName = compatible.filter(account => normalizedName(account.name) === normalizedName(pluggyAccount.name))
  return byName.length === 1 ? byName[0] : undefined
}

export async function savePluggyConnection(supabase: SupabaseClient, item: PluggyItem) {
  const { data: connection, error: connectionError } = await supabase
    .from('pluggy_connections')
    .upsert({
      pluggy_item_id: item.id,
      institution_name: item.connector?.name || 'Instituição financeira',
      status: item.executionStatus || item.status || 'UPDATING',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'pluggy_item_id' })
    .select('id, pluggy_item_id, institution_name, status, created_at')
    .single()

  if (connectionError) throw new Error(connectionError.message)

  const [remoteAccounts, localResult, linksResult] = await Promise.all([
    listPluggyAccounts(item.id),
    supabase.from('accounts').select('id, name, type, last_four'),
    supabase.from('pluggy_account_links').select('pluggy_account_id, app_account_id'),
  ])

  if (localResult.error) throw new Error(localResult.error.message)
  if (linksResult.error) throw new Error(linksResult.error.message)

  const localAccounts = [...(localResult.data ?? [])] as LocalAccount[]
  const existingLinkByPluggyId = new Map(
    (linksResult.data ?? []).map(link => [link.pluggy_account_id, link.app_account_id])
  )

  for (const remoteAccount of remoteAccounts) {
    let localAccount = findMatchingAccount(
      remoteAccount,
      localAccounts,
      existingLinkByPluggyId.get(remoteAccount.id) ?? null
    )

    if (!localAccount) {
      const type = accountType(remoteAccount)
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          name: `${connection.institution_name} • ${remoteAccount.name}`,
          type,
          holder: remoteAccount.owner || null,
          last_four: lastFour(remoteAccount),
          color: type === 'credit_card' ? '#8b5cf6' : '#10b981',
          limit_brl: 0,
        })
        .select('id, name, type, last_four')
        .single()

      if (error) throw new Error(error.message)
      localAccount = data as LocalAccount
      localAccounts.push(localAccount)
    }

    const { error } = await supabase
      .from('pluggy_account_links')
      .upsert({
        pluggy_account_id: remoteAccount.id,
        connection_id: connection.id,
        app_account_id: localAccount.id,
        pluggy_name: remoteAccount.name,
        pluggy_type: remoteAccount.type,
        currency_code: remoteAccount.currencyCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'pluggy_account_id' })

    if (error) throw new Error(error.message)
  }

  return { ...connection, accounts_added_or_linked: remoteAccounts.length }
}