import { NextResponse } from 'next/server'
import { extractText, getDocumentProxy } from 'unpdf'
import { checkToken } from '@/lib/supabase-admin'
import { parseItauPdf } from '@/lib/itau-parser'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'arquivo não enviado' }, { status: 400 })

    // Log pra ajudar a debugar
    console.log('PDF recebido:', file.name, file.size, 'bytes')

    const buffer = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buffer)
    const { text } = await extractText(pdf, { mergePages: true })

    console.log('Texto extraído:', text.length, 'caracteres')

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: 'PDF parece estar vazio ou protegido. Texto extraído: ' + (text?.length || 0) + ' chars.' },
        { status: 400 }
      )
    }

    const parsed = parseItauPdf(text)

    if (!parsed.transactions.length) {
      // Pega uma amostra do texto pra ajudar
      const amostra = text.slice(0, 300).replace(/\s+/g, ' ')
      return NextResponse.json(
        {
          error: 'Nenhum lançamento encontrado. Formato do PDF não reconhecido.',
          hint: 'Amostra do texto: ' + amostra,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('parse-pdf error:', err)
    return NextResponse.json(
      { error: err.message || 'erro ao processar PDF', stack: err.stack?.split('\n').slice(0, 3) },
      { status: 500 }
    )
  }
}