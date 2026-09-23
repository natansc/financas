import { resolveCategory } from '@/lib/categorize'

export type ParsedTx = {
  purchase_date: string
  description: string
  amount_brl: number
  category: string | null
  installment: string
}

export type ParsedInvoice = {
  payment_date: string
  invoice_month: string
  holder: string | null
  card_last_four: string | null
  total: number | null
  transactions: ParsedTx[]
}

// ============================================================
// 1. Blocos
// ============================================================
const BLOCKS: Array<{ start: RegExp; end: RegExp }> = [
  {
    start: /Lan[çc]amentos\s*:\s*compras e saques/gi,
    end:   /Lan[çc]amentos no cart[ãa]o/gi,
  },
  {
    start: /Lan[çc]amentos\s*:\s*produtos e servi[çc]os/gi,
    end:   /Lan[çc]amentos produtos e servi[çc]os/gi,
  },
  {
    start: /Lan[çc]amentos internacionais/gi,
    end:   /Total transa[çc][õo]es inter/gi,
  },
]

function sliceBlocks(text: string): string[] {
  const slices: string[] = []
  for (const { start, end } of BLOCKS) {
    start.lastIndex = 0
    let mStart: RegExpExecArray | null
    while ((mStart = start.exec(text)) !== null) {
      const from = mStart.index + mStart[0].length
      end.lastIndex = from
      const mEnd = end.exec(text)
      const to = mEnd ? mEnd.index : text.length
      if (to - from > 5) slices.push(text.slice(from, to))
      start.lastIndex = to
    }
  }
  return slices
}

// ============================================================
// 2. Helpers
// ============================================================
function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseMoney(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

function inferYear(dia: number, mes: number, vencimento: Date): number {
  const yV = vencimento.getFullYear()
  const mV = vencimento.getMonth() + 1
  if (mes > mV) return yV - 1
  return yV
}

function extractInstallment(desc: string): string {
  const m = desc.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (m) {
    const n = +m[1]; const t = +m[2]
    if (t >= 2 && t <= 24 && n >= 1 && n <= t) return `${n}/${t}`
  }
  return 'Única'
}

function stripInstallment(desc: string): string {
  return desc.replace(/\s*\b\d{1,2}\/\d{1,2}\b\s*$/, '').trim()
}

// ============================================================
// 3. Categoria — do rabo da linha (o próprio Itaú escreve)
// ============================================================
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Chaves sempre minúsculas sem acento */
const ITAU_CATS: Record<string, string> = {
  'outros':         'Outros',
  'outras':         'Outros',
  'diversos':       'Outros',
  'supermercado':   'Supermercado',
  'supermarket':    'Supermercado',
  'lazer':          'Lazer',
  'viagem':         'Viagem',
  'viaagem':        'Viagem',
  'hotel':          'Viagem',
  'turismo':        'Viagem',
  'veiculos':       'Transporte',
  'transporte':     'Transporte',
  'estacionamento': 'Transporte',
  'saude':          'Saúde',
  'casa':           'Casa',
  'educacao':       'Educação',
  'estudario':      'Educação',
  'vestuario':      'Vestuário',
  'servicos':       'Serviços',
  'restaurante':    'Alimentação',
  'alimentacao':    'Alimentação',
  'farmacia':       'Farmácia',
  'petshop':        'Pet',
  'pet':            'Pet',
  'posto':          'Combustível',
  'combustivel':    'Combustível',
  'automobile':     'Outros',
  'hobby':          'Outros',
}

function extractItauCategory(tail: string): string | null {
  if (!tail) return null
  const parts = normalize(tail).split(/\s+/)
  for (const p of parts) {
    if (ITAU_CATS[p]) return ITAU_CATS[p]
  }
  return null
}

// ============================================================
// 4. Extração
// ============================================================
/**
 * Regex captura:
 *   1 = DD | 2 = MM | 3 = descrição | 4 = valor | 5 = rabo (categoria+cidade)
 */
const RE_TX = /(\d{2})\/(\d{2})([\s\S]{1,300}?)(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{0,60})?/g

function parseBlock(block: string, vencimento: Date): ParsedTx[] {
  const txs: ParsedTx[] = []

  RE_TX.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = RE_TX.exec(block)) !== null) {
    const [, dd, mm, rawDesc, rawVal, tail] = m

    const dia = +dd
    const mes = +mm
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

    // Limpa descrição
    let desc = rawDesc
      .replace(/^(DATA|ESTABELECIMENTO|VALOR EM R\$)\s*/gi, '')
      .replace(/^[:\-–\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (desc.length < 2) continue
    if (/^(data|estabelecimento|valor em|total|lan[çc]amento|pr[óo]xima|demais)/i.test(desc)) continue

    // Se termina com "/" cortamos no meio do parcelamento
    if (desc.endsWith('/') && /^\d/.test(rawVal)) {
      desc = desc + rawVal[0]
    }

    // Valor: PDF usa positivo pra compras, negativo pra estornos.
    // Banco: nega o valor.
    const pdfValue = parseMoney(rawVal)
    const amountBrl = -pdfValue

    const year = inferYear(dia, mes, vencimento)
    const purchase_date = toIso(year, mes, dia)

    const installment = extractInstallment(desc)
    const cleanDesc = installment !== 'Única' ? stripInstallment(desc) : desc

    if (cleanDesc.length < 2) continue

    // Categoria do rabo
    const itauCat = extractItauCategory(tail || '')
    const category = resolveCategory(itauCat, cleanDesc)

    txs.push({
      purchase_date,
      description: cleanDesc,
      amount_brl: amountBrl,
      category,
      installment,
    })
  }

  return txs
}

// ============================================================
// 5. Header do PDF
// ============================================================
const RE_VENC  = /(?:Com vencimento em|Vencimento)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i
const RE_HOLD  = /Titular\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+Cart/i
const RE_CARD  = /Cart[ãa]o\s+([\d.X]+)/i
const RE_TOTAL = /total da sua fatura é:\s*R\$\s*([\d.,]+)/i

// ============================================================
// 6. Função principal
// ============================================================
export function parseItauPdf(rawText: string): ParsedInvoice {
  const text = rawText.normalize('NFC')

  const venc = text.match(RE_VENC)
  if (!venc) throw new Error('Vencimento não encontrado no PDF')
  const [, vd, vm, vy] = venc
  const vencimento = new Date(+vy, +vm - 1, +vd)
  const payment_date = toIso(+vy, +vm, +vd)
  const invoice_month = `${vy}-${vm}`

  const holder = (text.match(RE_HOLD)?.[1] || '').trim() || null
  const card_last_four =
    (text.match(RE_CARD)?.[1] || '').replace(/[.\sX]/g, '').slice(-4) || null

  const totalMatch = text.match(RE_TOTAL)
  const total = totalMatch ? parseMoney(totalMatch[1]) : null

  const blocks = sliceBlocks(text)
  const transactions: ParsedTx[] = []
  for (const b of blocks) transactions.push(...parseBlock(b, vencimento))

  return { payment_date, invoice_month, holder, card_last_four, total, transactions }
}