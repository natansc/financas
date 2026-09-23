'use client'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import CategorySelect from '@/components/CategorySelect'

type Account = {
  id: string
  name: string
  type: string
  last_four?: string | null
  color?: string
}

type Props = {
  accounts: Account[]
  initial?: any | null
  onSaved: () => void
  onClose: () => void
}

const INSTALLMENT_OPTIONS = Array.from({ length: 23 }, (_, i) => i + 2)

function splitInstallments(total: number, n: number): number[] {
  const totalCents = Math.round(total * 100)
  const baseCents = Math.floor(totalCents / n)
  const arr = Array(n).fill(baseCents)
  arr[n - 1] += totalCents - baseCents * n
  return arr.map(c => c / 100)
}

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Próximo vencimento padrão (dia 08 do mês que vem) */
function defaultPaymentDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-08`
}

export default function TransactionForm({ accounts, initial, onSaved, onClose }: Props) {
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [mode, setMode] = useState<'single' | 'installment'>('single')

  const buildForm = () => ({
    id: initial?.id,
    account_id: initial?.account_id || accounts[0]?.id || '',
    purchase_date: initial?.purchase_date || new Date().toISOString().slice(0, 10),
    payment_date: initial?.payment_date || defaultPaymentDate(),
    first_invoice_month: initial?.invoice_month || new Date().toISOString().slice(0, 7),
    description: initial?.description || '',
    category: initial?.category || '',
    amount:
      initial?.amount_brl !== undefined
        ? Math.abs(initial.amount_brl).toFixed(2).replace('.', ',')
        : '',
    total: '',
    installments: 2,
    type:
      initial?.amount_brl !== undefined
        ? (initial.amount_brl >= 0 ? 'receita' : 'despesa')
        : ('despesa' as 'receita' | 'despesa'),
  })

  const [form, setForm] = useState<any>(buildForm())

  useEffect(() => {
    if (!form.account_id && accounts[0]) {
      setForm((f: any) => ({ ...f, account_id: accounts[0].id }))
    }
  }, [accounts])

  const selectedAccount = accounts.find(a => a.id === form.account_id)
  const isCreditCard = selectedAccount?.type === 'credit_card'
  const showInstallmentUI = isCreditCard && !isEdit

  const parseValue = (s: string) =>
    parseFloat(String(s).replace(/\./g, '').replace(',', '.'))

  const preview = useMemo(() => {
    if (mode !== 'installment') return []
    const total = parseValue(form.total)
    if (isNaN(total) || total <= 0) return []
    const values = splitInstallments(total, form.installments)
    return values.map((v, i) => ({
      n: i + 1,
      value: v,
      month: addMonths(form.first_invoice_month, i),
    }))
  }, [mode, form.total, form.installments, form.first_invoice_month])

  /** Calcula o payment_date final */
  const finalPaymentDate = isCreditCard ? form.payment_date : form.purchase_date

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.account_id) return alert('Cadastre uma conta primeiro')

    setSaving(true)
    setFeedback(null)

    try {
      // EDIÇÃO
      if (isEdit) {
        const value = parseValue(form.amount)
        if (isNaN(value)) throw new Error('Valor inválido')
        const amount_brl = form.type === 'despesa' ? -Math.abs(value) : Math.abs(value)
        const res = await api.patch('/api/transactions', {
          id: form.id,
          account_id: form.account_id,
          purchase_date: form.purchase_date,
          payment_date: finalPaymentDate,
          invoice_month: isCreditCard ? form.first_invoice_month : null,
          description: form.description,
          category: form.category || null,
          amount_brl,
        })
        if (res?.error) throw new Error(res.error)
        onSaved()
        onClose()
        return
      }

      // CRIAÇÃO PARCELADA
      if (mode === 'installment') {
        const total = parseValue(form.total)
        if (isNaN(total) || total <= 0) throw new Error('Valor total inválido')
        if (form.installments < 2) throw new Error('Mínimo 2 parcelas')

        const values = splitInstallments(total, form.installments)
        const payload = values.map((v, i) => {
          const month = addMonths(form.first_invoice_month, i)
          return {
            account_id: form.account_id,
            purchase_date: form.purchase_date,
            payment_date: `${month}-08`,
            invoice_month: month,
            description: form.description,
            category: form.category || null,
            amount_brl: form.type === 'despesa' ? -v : v,
            installment: `${i + 1}/${form.installments}`,
            card_name: 'Manual',
            card_last_four: '',
            source: 'manual',
          }
        })
        const res = await api.post('/api/transactions', payload)
        if (res?.error) throw new Error(res.error)
      }
      // CRIAÇÃO À VISTA
      else {
        const value = parseValue(form.amount)
        if (isNaN(value)) throw new Error('Valor inválido')
        const amount_brl = form.type === 'despesa' ? -Math.abs(value) : Math.abs(value)
        const res = await api.post('/api/transactions', {
          account_id: form.account_id,
          purchase_date: form.purchase_date,
          payment_date: finalPaymentDate,
          invoice_month: isCreditCard ? form.first_invoice_month : null,
          description: form.description,
          category: form.category || null,
          amount_brl,
          installment: 'Única',
          card_name: 'Manual',
          card_last_four: '',
          source: 'manual',
        })
        if (res?.error) throw new Error(res.error)
      }

      onSaved()
      setForm((f: any) => ({
        ...f,
        description: '',
        category: '',
        amount: '',
        total: '',
        installments: 2,
      }))
      setFeedback('✓ Adicionado. Pode lançar outro.')
      setTimeout(() => setFeedback(null), 2000)
    } catch (err) {
      setFeedback('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h3>
        <button type="button" onClick={onClose} className="text-sm text-gray-500">fechar</button>
      </div>

      {isEdit && initial?.installment && initial.installment !== 'Única' && (
        <p className="text-xs bg-amber-50 text-amber-700 p-2 rounded">
          Esta é a parcela <b>{initial.installment}</b> de uma compra parcelada.
          Editar aqui altera <b>apenas esta parcela</b>.
        </p>
      )}

      {/* Tipo */}
      <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
        {(['despesa', 'receita'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setForm({ ...form, type: t })}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              form.type === t
                ? t === 'despesa'
                  ? 'bg-red-500 text-white'
                  : 'bg-green-500 text-white'
                : 'text-gray-600'
            }`}
          >
            {t === 'despesa' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      {/* Conta */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Conta</span>
        <select
          value={form.account_id}
          onChange={e => setForm({ ...form, account_id: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base bg-white"
          required
        >
          {!accounts.length && <option value="">Cadastre uma conta primeiro</option>}
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>

      {/* Toggle à vista / parcelado */}
      {showInstallmentUI && (
        <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
          {(['single', 'installment'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === m ? 'bg-blue-600 text-white' : 'text-gray-600'
              }`}
            >
              {m === 'single' ? 'À vista' : 'Parcelado'}
            </button>
          ))}
        </div>
      )}

      {/* Data + valor */}
      {(mode === 'single' || !showInstallmentUI) && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Data da compra</span>
            <input
              type="date"
              required
              value={form.purchase_date}
              onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Valor (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base"
              placeholder="0,00"
            />
          </label>
        </div>
      )}

      {/* Data + valor: parcelado */}
      {showInstallmentUI && mode === 'installment' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Data da compra</span>
            <input
              type="date"
              required
              value={form.purchase_date}
              onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Valor total (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.total}
              onChange={e => setForm({ ...form, total: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base"
              placeholder="0,00"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">1ª fatura</span>
            <input
              type="month"
              required
              value={form.first_invoice_month}
              onChange={e => setForm({ ...form, first_invoice_month: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Parcelas</span>
            <select
              value={form.installments}
              onChange={e => setForm({ ...form, installments: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-base bg-white"
            >
              {INSTALLMENT_OPTIONS.map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Descrição */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Descrição</span>
        <input
          type="text"
          required
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-base"
          placeholder="Ex: Notebook Dell"
        />
      </label>

      {/* Categoria */}
      <CategorySelect
        value={form.category}
        onChange={v => setForm({ ...form, category: v })}
        kind={form.type}
      />

      {/* Vencimento — só pra cartão de crédito, à vista */}
      {isCreditCard && mode === 'single' && (
        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            Vencimento da fatura
          </span>
          <input
            type="date"
            value={form.payment_date}
            onChange={e => setForm({ ...form, payment_date: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
          <span className="text-xs text-gray-400">
            Quando esse valor realmente sai da sua conta. Padrão: dia 08 do próximo mês.
          </span>
        </label>
      )}

      {isEdit && isCreditCard && (
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Vencimento da fatura</span>
          <input
            type="date"
            value={form.payment_date}
            onChange={e => setForm({ ...form, payment_date: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </label>
      )}

      {/* Preview das parcelas */}
      {mode === 'installment' && preview.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-800 mb-2">
            {preview.length}x de{' '}
            {preview[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            {' '}(última pode variar 1 centavo)
          </p>
          <div className="max-h-40 overflow-auto text-xs space-y-0.5">
            {preview.map(p => (
              <div key={p.n} className="flex justify-between text-blue-700">
                <span>{p.n}/{form.installments} • venc {p.month}-08</span>
                <span>
                  {p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <p className={`text-sm ${feedback.startsWith('Erro') ? 'text-red-600' : 'text-green-600'}`}>
          {feedback}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !accounts.length}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {saving
          ? 'Salvando...'
          : isEdit
            ? 'Salvar alterações'
            : mode === 'installment'
              ? `Adicionar ${form.installments}x`
              : 'Adicionar'}
      </button>
    </form>
  )
}