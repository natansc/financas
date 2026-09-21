'use client'
import { useState } from 'react'
import Papa from 'papaparse'
import { api } from '@/lib/api'

export default function CsvImporter() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parseDate = (s: string) => {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }

  const parseMoney = (s: string) =>
    parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    setError(null)

    Papa.parse(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
            .map((r: any) => ({
              purchase_date: parseDate(r['Data de Compra']),
              card_name: r['Nome no Cartão']?.trim() || 'Manual',
              card_last_four: r['Final do Cartão']?.trim() || '0000',
              category: r['Categoria'] && r['Categoria'] !== '-' ? r['Categoria'].trim() : null,
              description: r['Descrição']?.trim() || '',
              installment: r['Parcela']?.trim() || 'Única',
              amount_usd: parseMoney(r['Valor (em US$)']),
              exchange_rate: parseMoney(r['Cotação (em R$)']),
              amount_brl: parseMoney(r['Valor (em R$)']),
              source: 'csv',
            }))
            .filter(r => r.description && r.purchase_date)

          const res = await api.post('/api/import', rows)
          if (res.error) throw new Error(res.error)
          setResult({ inserted: res.inserted, duplicates: res.duplicates })
        } catch (err: any) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      },
      error: (err) => {
        setError(err.message)
        setLoading(false)
      },
    })
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Escolher CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleUpload}
          disabled={loading}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white"
        />
      </label>

      {loading && <p className="text-sm text-gray-500">Processando...</p>}

      {result && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✅ {result.inserted} importadas • {result.duplicates} duplicadas ignoradas
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Erro: {error}
        </div>
      )}
    </div>
  )
}