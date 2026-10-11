'use client'
import { useState } from 'react'
import CsvImporter from '@/components/CsvImporter'
import PdfImporter from '@/components/PdfImporter'
import PluggyImporter from '@/components/PluggyImporter'

export default function ImportPage() {
  const [tab, setTab] = useState<'itau-invoice' | 'c6-invoice' | 'c6-statement' | 'pluggy'>('itau-invoice')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setTab('itau-invoice')}
          className={`py-2 rounded-md text-sm font-medium ${tab === 'itau-invoice' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          Fatura Itaú (PDF)
        </button>
        <button
          onClick={() => setTab('c6-invoice')}
          className={`py-2 rounded-md text-sm font-medium ${tab === 'c6-invoice' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          Fatura C6 (CSV)
        </button>
        <button
          onClick={() => setTab('c6-statement')}
          className={`py-2 rounded-md text-sm font-medium ${tab === 'c6-statement' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          Extrato C6 (CSV)
        </button>
        <button
          onClick={() => setTab('pluggy')}
          className={`py-2 rounded-md text-sm font-medium ${tab === 'pluggy' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          Pluggy
        </button>
      </div>

      {tab === 'itau-invoice' && <PdfImporter />}
      {tab === 'c6-invoice' && <CsvImporter mode="invoice" />}
      {tab === 'c6-statement' && <CsvImporter mode="statement" />}
      {tab === 'pluggy' && <PluggyImporter />}
    </div>
  )
}