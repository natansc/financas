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
// 1. BLOCOS
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
// 3. Extração
// ============================================================
/**
 * Regex global sobre o bloco:
 *   "DD/MM" + descrição (1-300 chars, lazy) + valor (com - opcional)
 *
 * Valor é a âncora. Cada match consome até o valor (inclusive).
 */
const RE_TX = /(\d{2})\/(\d{2})([\s\S]{1,300}?)(-?\d{1,3}(?:\.\d{3})*,\d{2})/g

function parseBlock(block: string, vencimento: Date): ParsedTx[] {
  const txs: ParsedTx[] = []

  RE_TX.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = RE_TX.exec(block)) !== null) {
    const [, dd, mm, rawDesc, rawVal] = m

    const dia = +dd
    const mes = +mm
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

    // Limpa a descrição
    let desc = rawDesc
      .replace(/^(DATA|ESTABELECIMENTO|VALOR EM R\$)\s*/gi, '')
      .replace(/^[:\-–\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (desc.length < 2) continue
    if (/^(data|estabelecimento|valor em|total|lan[çc]amento|pr[óo]xima|demais)/i.test(desc)) continue

    // Se termina com "/" é sinal de que cortamos no meio do parcelamento
    if (desc.endsWith('/') && /^\d/.test(rawVal)) {
      desc = desc + rawVal[0]
    }

    // Sinal: o PDF mostra compras como positivas e estornos como negativas.
    // No banco é o oposto → negamos o valor.
    const pdfValue = parseMoney(rawVal)
    const amountBrl = -pdfValue

    const year = inferYear(dia, mes, vencimento)
    const purchase_date = toIso(year, mes, dia)

    const installment = extractInstallment(desc)
    const cleanDesc = installment !== 'Única' ? stripInstallment(desc) : desc

    if (cleanDesc.length < 2) continue

    txs.push({
      purchase_date,
      description: cleanDesc,
      amount_brl: amountBrl,
      category: null,
      installment,
    })
  }

  return txs
}

// ============================================================
// 4. Header do PDF
// ============================================================
const RE_VENC  = /(?:Com vencimento em|Vencimento)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i
const RE_HOLD  = /Titular\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+Cart/i
const RE_CARD  = /Cart[ãa]o\s+([\d.X]+)/i
const RE_TOTAL = /total da sua fatura é:\s*R\$\s*([\d.,]+)/i

// ============================================================
// 5. Função principal
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