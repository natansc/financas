'use client'
import { useState } from 'react'
import CsvImporter from '@/components/CsvImporter'
import PdfImporter from '@/components/PdfImporter'

export default function ImportPage() {
  const [tab, setTab] = useState<'csv' | 'pdf'>('pdf')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar fatura</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setTab('pdf')}
          className={`flex-1 py-2 rounded-md text-sm font-medium ${tab === 'pdf' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          PDF (Itaú)
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`flex-1 py-2 rounded-md text-sm font-medium ${tab === 'csv' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          CSV
        </button>
      </div>

      {tab === 'pdf' ? <PdfImporter /> : <CsvImporter />}
    </div>
  )
}