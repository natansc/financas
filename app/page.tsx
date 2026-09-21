'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import DashboardCards from '@/components/DashboardCards'
import CategoryChart from '@/components/CategoryChart'

export default function Home() {
  const [txs, setTxs] = useState<any[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/transactions?month=${month}`).then((data) => {
      setTxs(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [month])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
      </div>
      {loading ? <p className="text-sm text-gray-500">Carregando...</p> : (
        <>
          <DashboardCards transactions={txs} />
          <CategoryChart transactions={txs} />
        </>
      )}
    </div>
  )
}