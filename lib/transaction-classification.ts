type TransactionAmount = {
  amount_brl: number
  source?: string | null
  accounts?: { type?: string | null } | null
}

export function isC6CardRefund(transaction: TransactionAmount): boolean {
  return transaction.amount_brl > 0
    && transaction.source === 'csv'
    && transaction.accounts?.type === 'credit_card'
}
