'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const names = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`
}

function monthFull(ym: string) {
  const [y, m] = ym.split('-')
  const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${names[parseInt(m) - 1]} ${y}`
}

export default function CardsPage() {
  const [data, setData] = useState<any>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)

  const load = () => {
    setLoading(true)
    api.get(`/api/cards?months=6&month=${month}`).then(d => {
      setData(d)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [month])

  useEffect(() => {
    if (!selected || !data) return
    api.get(`/api/cards/${selected}?month=${data.selected_month}`).then(setDetails)
  }, [selected, data])

  const currentCard = data?.cards?.find((c: any) => c.id === selected)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cartões</h1>

      {/* Seletor de mês */}
      <div className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-2">
        <label className="flex-1">
          <span className="block text-xs font-medium text-gray-500 mb-1">Mês</span>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </label>
        {data?.months_with_data?.length > 0 && (
          <button
            type="button"
            onClick={() => setMonth(data.months_with_data[0])}
            className="text-xs text-blue-600 mt-5 whitespace-nowrap"
          >
            Ir p/ último<br />com dados
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}

      {/* Lista de cartões */}
      {!loading && data && !selected && (
        <div className="space-y-3">
          {data.cards.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                  <span className="font-medium">{c.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {c.last_four ? `••${c.last_four}` : ''}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xl font-bold text-red-600">
                  {fmtBRL(c.current_total)}
                </span>
                {c.variation_pct !== 0 && (
                  <span className={`text-xs font-medium ${c.variation_pct > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {c.variation_pct > 0 ? '↑' : '↓'} {Math.abs(c.variation_pct).toFixed(0)}% vs mês anterior
                  </span>
                )}
              </div>

              {c.limit_brl > 0 && (
                <>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(c.limit_used_pct, 100)}%`,
                        background: c.limit_used_pct > 80 ? '#ef4444' : c.limit_used_pct > 50 ? '#f59e0b' : c.color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.limit_used_pct.toFixed(0)}% do limite de {fmtBRL(c.limit_brl)}
                  </p>
                </>
              )}
            </button>
          ))}
          {!data.cards.length && (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhum cartão cadastrado. Vá em <b>Contas</b> e marque um como tipo "Cartão de crédito".
            </p>
          )}
        </div>
      )}

      {/* Detalhes do cartão selecionado */}
      {currentCard && (
        <>
          <button
            onClick={() => { setSelected(null); setDetails(null) }}
            className="text-sm text-blue-600 mb-2"
          >
            ← voltar
          </button>

          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ background: currentCard.color }} />
              <span className="font-semibold">{currentCard.name}</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mb-1">
              {fmtBRL(currentCard.current_total)}
            </p>
            <p className="text-xs text-gray-500">
              {monthFull(data.selected_month)}
              {currentCard.limit_brl > 0 && (
                <> • Limite disponível: {fmtBRL(currentCard.limit_brl - currentCard.current_total)}</>
              )}
            </p>
          </div>

          {/* Evolução mensal */}
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Evolução dos últimos 6 meses</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentCard.monthly.map((m: any) => ({ ...m, label: monthLabel(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}` }
                  />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={currentCard.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top categorias */}
          {currentCard.top_categories.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-sm font-semibold mb-3">
                Gastos por categoria • {monthLabel(data.selected_month)}
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentCard.top_categories}
                    layout="vertical"
                    margin={{ left: 0, right: 10 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
                    />
                    <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {currentCard.top_categories.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top estabelecimentos */}
          {details?.top_stores?.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-sm font-semibold mb-3">
                Top estabelecimentos • {monthLabel(data.selected_month)}
              </h2>
              <ul className="space-y-2">
                {details.top_stores.map((s: any, i: number) => (
                  <li key={i} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                    <span className="truncate mr-2 text-gray-700">
                      {i + 1}. {s.name}
                      {s.count > 1 && <span className="text-xs text-gray-400 ml-1">({s.count}x)</span>}
                    </span>
                    <span className="font-medium shrink-0">{fmtBRL(s.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}