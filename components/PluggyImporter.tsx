'use client'

import { useEffect, useState } from 'react'
import type { PluggyConnectProps } from 'react-pluggy-connect'
import { Download, Link2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

type LocalAccount = {
  id: string
  name: string
  type: string
  last_four: string | null
}

type PluggyAccount = {
  id: string
  name: string
  type: 'BANK' | 'CREDIT'
  number?: string
  currencyCode: string
  creditData?: { balanceDueDate?: string | null } | null
  app_account_id: string | null
  app_account_name: string | null
}

type PluggyConnection = {
  id: string
  pluggy_item_id: string
  institution_name: string
  status: string
  accounts: PluggyAccount[]
  load_error: string | null
}

type SyncResult = {
  imported: number
  duplicates: number
  ignored_pending: number
  ignored_foreign_currency: number
  total: number
}

type PluggyState = {
  connections: PluggyConnection[]
  local_accounts: LocalAccount[]
}

async function fetchPluggyState(): Promise<PluggyState> {
  return api.get('/api/pluggy/connections')
}

function accountTypeLabel(type: PluggyAccount['type']) {
  return type === 'CREDIT' ? 'Cartão de crédito' : 'Conta bancária'
}

function canLink(account: PluggyAccount, local: LocalAccount) {
  return account.type === 'CREDIT'
    ? local.type === 'credit_card'
    : local.type !== 'credit_card'
}

function getApiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message !== 'unauthorized') return message

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'Esta tela está rodando localmente. O localhost não recebe as variáveis da Vercel; abra o app pelo endereço publicado na Vercel para carregar suas conexões.'
  }

  return 'A Vercel recusou o token interno do app. Confira se APP_TOKEN e NEXT_PUBLIC_APP_TOKEN estão configurados com o mesmo valor nas variáveis do projeto.'
}

export default function PluggyImporter() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [PluggyConnectComponent, setPluggyConnectComponent] = useState<((props: PluggyConnectProps) => React.JSX.Element) | null>(null)
  const [connections, setConnections] = useState<PluggyConnection[]>([])
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({})
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | undefined>()
  const [existingItemId, setExistingItemId] = useState('')
  const [fromMonth, setFromMonth] = useState(`${currentMonth.slice(0, 4)}-01`)
  const [toMonth, setToMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [importingExisting, setImportingExisting] = useState(false)
  const [importingItem, setImportingItem] = useState(false)
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyState = (data: PluggyState) => {
    setConnections(Array.isArray(data.connections) ? data.connections : [])
    const accounts = Array.isArray(data.local_accounts) ? data.local_accounts : []
    setLocalAccounts(accounts)
    setSelectedAccounts(current => {
      const next = { ...current }
      for (const connection of data.connections ?? []) {
        for (const account of connection.accounts ?? []) {
          if (account.app_account_id) next[account.id] = account.app_account_id
          else if (!next[account.id]) {
            next[account.id] = accounts.find(local => canLink(account, local))?.id ?? ''
          }
        }
      }
      return next
    })
  }

  const reload = async () => {
    setLoading(true)
    try {
      const data = await fetchPluggyState()
      if (data && 'error' in data) throw new Error(String(data.error))
      applyState(data)
      setError(null)
    } catch (cause) {
      setError(getApiErrorMessage(cause) || 'Falha ao carregar conexões Pluggy')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    import('react-pluggy-connect')
      .then(({ PluggyConnect }) => {
        if (active) setPluggyConnectComponent(() => PluggyConnect)
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar o widget Pluggy')
      })

    fetchPluggyState()
      .then(data => {
        if (!active) return
        if (data && 'error' in data) throw new Error(String(data.error))
        applyState(data)
      })
      .catch(cause => {
        if (active) setError(getApiErrorMessage(cause) || 'Falha ao carregar conexões Pluggy')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const startConnection = async (connectorId?: number) => {
    setConnecting(true)
    setError(null)
    setMessage(null)
    setSelectedConnectorId(connectorId)
    try {
      const response = await api.post('/api/pluggy/connect-token', {})
      if (response?.error) throw new Error(response.error)
      setConnectToken(response.accessToken)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a conexão')
    } finally {
      setConnecting(false)
    }
  }

  const importExistingConnections = async () => {
    setImportingExisting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await api.post('/api/pluggy/import-existing', {})
      if (response?.error) {
        throw new Error(`${response.error}${response.hint ? ` ${response.hint}` : ''}`)
      }
      setMessage(
        response.connections
          ? `${response.connections} conexões encontradas; ${response.accounts_linked} contas adicionadas ou vinculadas.`
          : 'Nenhuma conexão existente foi encontrada na Pluggy.'
      )
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar conexões existentes')
    } finally {
      setImportingExisting(false)
    }
  }

  const importConnectionById = async () => {
    const itemId = existingItemId.trim()
    if (!itemId) {
      setError('Informe o ID do item da conexão Pluggy.')
      return
    }

    setImportingItem(true)
    setError(null)
    setMessage(null)
    try {
      const response = await api.post('/api/pluggy/connections', { item_id: itemId })
      if (response?.error) throw new Error(String(response.error))
      setExistingItemId('')
      setMessage(
        `${response.institution_name}: ${response.accounts_added_or_linked} contas adicionadas ou vinculadas.`
      )
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar essa conexão')
    } finally {
      setImportingItem(false)
    }
  }

  const saveConnection = async (itemId: string) => {
    try {
      const response = await api.post('/api/pluggy/connections', { item_id: itemId })
      if (response?.error) throw new Error(response.error)
      setMessage('Instituição conectada; contas e cartões já foram adicionados ou vinculados.')
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a conexão')
    } finally {
      setConnectToken(null)
      setSelectedConnectorId(undefined)
    }
  }

  const linkAccount = async (connectionId: string, pluggyAccountId: string) => {
    const appAccountId = selectedAccounts[pluggyAccountId]
    if (!appAccountId) {
      setError('Selecione uma conta ou cartão local antes de vincular.')
      return
    }

    setSavingAccountId(pluggyAccountId)
    setError(null)
    setMessage(null)
    try {
      const response = await api.post('/api/pluggy/accounts', {
        connection_id: connectionId,
        pluggy_account_id: pluggyAccountId,
        app_account_id: appAccountId,
      })
      if (response?.error) throw new Error(response.error)
      setMessage('Conta vinculada.')
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível vincular a conta')
    } finally {
      setSavingAccountId(null)
    }
  }

  const syncAccount = async (pluggyAccountId: string) => {
    const period = getSelectedPeriod()
    if (!period) return

    setSyncingAccountId(pluggyAccountId)
    setError(null)
    setMessage(null)
    try {
      const response = await api.post('/api/pluggy/sync', {
        pluggy_account_id: pluggyAccountId,
        ...period,
      })
      if (response?.error) throw new Error(response.error)
      const result = response as SyncResult
      const skipped = result.ignored_pending + result.ignored_foreign_currency
      setMessage(
        `${result.imported} novas, ${result.duplicates} já existentes` +
        (skipped ? `, ${skipped} ignoradas (pendentes ou moeda não BRL)` : '')
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao importar movimentações')
    } finally {
      setSyncingAccountId(null)
    }
  }

  const syncAll = async () => {
    const period = getSelectedPeriod()
    if (!period) return

    const linkedAccounts = connections.flatMap(connection =>
      connection.accounts.filter(account => account.app_account_id)
    )
    if (!linkedAccounts.length) return

    setSyncingAll(true)
    setError(null)
    setMessage(null)
    let imported = 0
    let duplicates = 0
    try {
      for (const account of linkedAccounts) {
        const response = await api.post('/api/pluggy/sync', {
          pluggy_account_id: account.id,
          ...period,
        })
        if (response?.error) throw new Error(`${account.name}: ${response.error}`)
        imported += response.imported ?? 0
        duplicates += response.duplicates ?? 0
      }
      setMessage(`${imported} novas, ${duplicates} já existentes em ${linkedAccounts.length} contas`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao importar todas as contas')
    } finally {
      setSyncingAll(false)
    }
  }

  const linkedCount = connections.reduce(
    (total, connection) => total + connection.accounts.filter(account => account.app_account_id).length,
    0
  )

  const getSelectedPeriod = () => {
    if (!fromMonth || !toMonth) {
      setError('Selecione o mês inicial e o mês final do período.')
      return null
    }
    if (fromMonth > toMonth) {
      setError('O mês inicial precisa ser anterior ou igual ao mês final.')
      return null
    }

    const [year, month] = toMonth.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    return { date_from: `${fromMonth}-01`, date_to: lastDay }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Contas conectadas</h2>
          <p className="text-xs text-gray-500">Contas existentes na Pluggy viram contas e cartões no app.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            title="Atualizar conexões"
            aria-label="Atualizar conexões"
            className="grid size-10 place-items-center rounded-lg border bg-white text-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={17} />
          </button>
          <button
            type="button"
            onClick={() => void importExistingConnections()}
            disabled={importingExisting || loading}
            className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50"
          >
            {importingExisting ? 'Buscando...' : 'Importar conexões existentes'}
          </button>
          <button
            type="button"
            onClick={() => void startConnection(200)}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Link2 size={16} />
            {connecting ? 'Preparando...' : 'Conectar via Meu Pluggy'}
          </button>
          <button
            type="button"
            onClick={() => void startConnection()}
            disabled={connecting}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            Outro banco
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        Para usar conexões pessoais existentes, conecte seus bancos no{' '}
        <a href="https://meu.pluggy.ai/" target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
          Meu Pluggy
        </a>{' '}
        e depois use o botão Meu Pluggy acima.{' '}
        <a href="https://meu.pluggy.ai/api-guide" target="_blank" rel="noreferrer" className="text-blue-700 underline">
          Guia oficial
        </a>
      </p>

      <fieldset className="rounded-lg border border-gray-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-gray-700">Período das movimentações</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">
            De
            <input
              type="month"
              value={fromMonth}
              max={toMonth || undefined}
              onChange={event => setFromMonth(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            />
          </label>
          <label className="text-xs text-gray-600">
            Até
            <input
              type="month"
              value={toMonth}
              min={fromMonth || undefined}
              max={currentMonth}
              onChange={event => setToMonth(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          O intervalo inclui extrato bancário e movimentações do cartão. Para o ano todo, escolha janeiro a dezembro.
        </p>
      </fieldset>

      {connectToken && PluggyConnectComponent && (
        <PluggyConnectComponent
          connectToken={connectToken}
          language="pt"
          includeSandbox={process.env.NODE_ENV !== 'production'}
          selectedConnectorId={selectedConnectorId}
          onSuccess={({ item }) => { void saveConnection(item.id) }}
          onError={({ message: widgetError }) => {
            setError(widgetError || 'A conexão não foi concluída')
            setConnectToken(null)
            setSelectedConnectorId(undefined)
          }}
          onClose={() => {
            setConnectToken(null)
            setSelectedConnectorId(undefined)
          }}
        />
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      <details className="rounded-lg border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Importar conexão pelo ID do item
        </summary>
        <p className="my-2 text-xs text-gray-500">
          Alternativa à listagem geral: busca uma conexão específica que já existe na sua aplicação Pluggy.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={existingItemId}
            onChange={event => setExistingItemId(event.target.value)}
            placeholder="ID do item Pluggy"
            aria-label="ID do item Pluggy"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void importConnectionById()}
            disabled={importingItem || !existingItemId.trim()}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {importingItem ? 'Importando...' : 'Buscar conexão'}
          </button>
        </div>
      </details>

      {linkedCount > 0 && (
        <button
          type="button"
          onClick={() => void syncAll()}
          disabled={syncingAll || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Download size={17} />
          {syncingAll ? 'Importando contas...' : `Importar todas (${linkedCount})`}
        </button>
      )}

      {loading && <p className="text-sm text-gray-500">Carregando conexões...</p>}

      {!loading && !connections.length && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Nenhuma instituição conectada.
        </p>
      )}

      {connections.map(connection => (
        <section key={connection.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{connection.institution_name}</h3>
              <p className="text-xs text-gray-500">{connection.status}</p>
            </div>
          </div>

          {connection.load_error && (
            <p className="mb-2 text-sm text-red-600">Não foi possível listar as contas: {connection.load_error}</p>
          )}

          <ul className="divide-y divide-gray-100">
            {connection.accounts.map(account => {
              const compatibleAccounts = localAccounts.filter(local => canLink(account, local))
              const isLinked = Boolean(account.app_account_id)
              const isSaving = savingAccountId === account.id
              const isSyncing = syncingAccountId === account.id || syncingAll

              return (
                <li key={account.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-gray-500">
                        {accountTypeLabel(account.type)}
                        {account.number ? ` • final ${account.number.slice(-4)}` : ''}
                        {account.currencyCode ? ` • ${account.currencyCode}` : ''}
                      </p>
                    </div>
                    {isLinked && (
                      <span className="shrink-0 text-xs font-medium text-emerald-700">Vinculada</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedAccounts[account.id] ?? ''}
                      onChange={event => setSelectedAccounts(current => ({
                        ...current,
                        [account.id]: event.target.value,
                      }))}
                      aria-label={`Conta local para ${account.name}`}
                      className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Selecione a conta local</option>
                      {compatibleAccounts.map(local => (
                        <option key={local.id} value={local.id}>
                          {local.name}{local.last_four ? ` ••${local.last_four}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void linkAccount(connection.id, account.id)}
                      disabled={isSaving || !compatibleAccounts.length}
                      className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : isLinked ? 'Alterar vínculo' : 'Vincular'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void syncAccount(account.id)}
                      disabled={!isLinked || isSyncing}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <Download size={15} />
                      {isSyncing ? 'Importando...' : 'Importar'}
                    </button>
                  </div>
                  {!compatibleAccounts.length && (
                    <p className="text-xs text-amber-700">Não há conta local compatível cadastrada para este tipo.</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}