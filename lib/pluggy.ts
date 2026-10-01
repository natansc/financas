// lib/pluggy.ts
const PLUGGY_API = 'https://api.pluggy.ai'

// Cache do apiKey em memória (válido por ~2h na Pluggy)
let cachedApiKey: { value: string; expiresAt: number } | null = null

export async function getPluggyApiKey(): Promise<string> {
  const now = Date.now()
  if (cachedApiKey && cachedApiKey.expiresAt > now) {
    return cachedApiKey.value
  }

  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Env vars ausentes: PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET'
    )
  }

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Falha ao autenticar na Pluggy: ${res.status} ${err}`)
  }

  const data = await res.json()
  cachedApiKey = {
    value: data.apiKey,
    expiresAt: now + 1000 * 60 * 100, // cache 100 min
  }
  return data.apiKey
}

async function pluggyFetch(path: string, init?: RequestInit) {
  const apiKey = await getPluggyApiKey()
  const res = await fetch(`${PLUGGY_API}${path}`, {
    ...init,
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pluggy ${path} falhou: ${res.status} ${err}`)
  }
  return res.json()
}

// ============ Tipos ============
export type PluggyItem = {
  id: string
  connector: { id: number; name: string; imageUrl?: string }
  status: string
  executionStatus: string
  createdAt: string
  updatedAt: string
  clientUserId?: string | null
}

export type PluggyAccount = {
  id: string
  itemId: string
  type: 'BANK' | 'CREDIT'
  subtype: string
  name: string
  number?: string
  owner?: string | null
  balance: number
  currencyCode: string
  creditData?: {
    balanceDueDate?: string | null
    creditLimit?: number | null
  } | null
}

export type PluggyTransaction = {
  id: string
  accountId: string
  date: string // ISO
  description: string
  descriptionRaw?: string
  amount: number // positivo = entrada, negativo = saída
  amountInAccountCurrency?: number | null
  type: 'CREDIT' | 'DEBIT'
  status?: string
  category?: string | null
  balance?: number
  currencyCode: string
  creditCardMetadata?: {
    purchaseDate?: string | null
    installmentNumber?: number | null
    totalInstallments?: number | null
    cardNumber?: string | null
    billId?: string | null
    billForecastDate?: string | null
  } | null
}

export type PluggyBill = {
  id: string
  dueDate?: string | null
  billClosingDate?: string | null
  totalAmount: number
  totalAmountCurrencyCode?: string | null
}

// ============ Endpoints ============
export async function listPluggyItems(): Promise<PluggyItem[]> {
  const items: PluggyItem[] = []
  let next: string | null = ''

  do {
    const page = await pluggyFetch(`/v2/items${next}`)
    items.push(...(page.results ?? []))
    next = page.next ?? null
  } while (next)

  return items
}

export async function createPluggyConnectToken(): Promise<string> {
  const data = await pluggyFetch('/connect_token', {
    method: 'POST',
    body: JSON.stringify({
      options: {
        clientUserId: 'finance-app',
        avoidDuplicates: true,
      },
    }),
  })
  return data.accessToken
}

export async function getPluggyItem(itemId: string): Promise<PluggyItem> {
  return pluggyFetch(`/items/${encodeURIComponent(itemId)}`)
}

export async function listPluggyAccounts(itemId: string): Promise<PluggyAccount[]> {
  const data = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`)
  return data.results ?? []
}

export async function listPluggyTransactions(
  accountId: string,
  from?: string, // YYYY-MM-DD
  to?: string
): Promise<PluggyTransaction[]> {
  const params = new URLSearchParams({ accountId })
  if (from) params.set('dateFrom', from)
  if (to) params.set('dateTo', to)

  const transactions: PluggyTransaction[] = []
  let next: string | null = `?${params.toString()}`

  while (next) {
    const page = await pluggyFetch(`/v2/transactions${next}`)
    transactions.push(...(page.results ?? []))
    next = page.next ?? null
  }

  return transactions
}

export async function listPluggyBills(accountId: string): Promise<PluggyBill[]> {
  const bills: PluggyBill[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const params = new URLSearchParams({ accountId, page: String(page), pageSize: '500' })
    const result = await pluggyFetch(`/bills?${params.toString()}`)
    bills.push(...(result.results ?? []))
    totalPages = result.totalPages ?? 1
    page += 1
  }

  return bills
}