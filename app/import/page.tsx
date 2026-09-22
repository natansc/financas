import CsvImporter from '@/components/CsvImporter'

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar fatura</h1>
      <p className="text-sm text-gray-600">
        Selecione a conta, o mês da fatura e o CSV exportado pelo banco.
        Duplicatas são ignoradas automaticamente.
      </p>
      <CsvImporter />
    </div>
  )
}