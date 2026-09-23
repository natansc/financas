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
// 1. BLOCOS — início e fim de cada seção que queremos ler
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

/**
 * Fatia o texto nos blocos mapeados. Suporta múltiplas ocorrências do
 * mesmo bloco (o Itaú repete em faturas diferentes).
 */
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

      if (to - from > 10) slices.push(text.slice(from, to))

      // Continua a busca DEPOIS do fim desse bloco
      start.lastIndex = to
    }
  }

  return slices
}

// ============================================================
// 2. Helpers básicos
// ============================================================
function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseMoney(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

/**
 * Se a compra é em mês posterior ao vencimento, é ano anterior.
 * Ex: venc set/2026 + compra 13/10 → 13/10/2025
 */
function inferYear(dia: number, mes: number, vencimento: Date): number {
  const yV = vencimento.getFullYear()
  const mV = vencimento.getMonth() + 1
  if (mes > mV) return yV - 1
  return yV
}

/** Detecta "X/Y" na descrição → installment */
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
// 3. Categoria — sempre normalizada (minúsculo, sem acento)
// ============================================================
/**
 * Normaliza: minúsculo, sem acento, sem pontuação.
 * Isso garante que "Lazer", "lazer", "LAZER", "lazér" todos virem "lazer".
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')      // pontuação → espaço
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mapa: chaves SEMPRE minúsculas e sem acento */
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
// 4. Extração de uma linha dentro de um bloco
// ============================================================
/**
 * Cada linha do Itaú (texto extraído do PDF) fica assim:
 *   "23/08MP *HBOMAXASSINOSASCOBR31,43outros OSASCO"
 * ou
 *   "01/08SUPER LIMA APARECIDA DEB149,36supermercado APARECIDA DE"
 *
 * Estratégia: split por lookahead de DD/MM, depois regex por linha.
 */
const LINE_RX = /^(\d{2})\/(\d{2})\s*([\s\S]+?)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*([\s\S]*)$/

function parseBlock(block: string, vencimento: Date): ParsedTx[] {
  const txs: ParsedTx[] = []

  // Divide em partes que começam com DD/MM
  const parts = block.split(/(?=\d{2}\/\d{2})/g)

  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue

    const m = part.match(LINE_RX)
    if (!m) continue

    const [, dd, mm, rawDesc, rawVal, tail] = m

    const dia = +dd; const mes = +mm
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

    // limpa a descrição
    let desc = rawDesc
      .replace(/^(DATA|ESTABELECIMENTO|VALOR EM R\$)\s*/gi, '')
      .replace(/^[:\-–\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (desc.length < 3) continue
    if (/^(data|estabelecimento|valor em|total|lan[çc]amento)/i.test(desc)) continue

    const amountBrl = -Math.abs(parseMoney(rawVal))
    const year = inferYear(dia, mes, vencimento)
    const purchase_date = toIso(year, mes, dia)

    const installment = extractInstallment(desc)
    const cleanDesc = installment !== 'Única' ? stripInstallment(desc) : desc
    if (cleanDesc.length < 3) continue

    const category = extractItauCategory(tail || '')

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

  // Fatia os blocos e extrai de cada um
  const blocks = sliceBlocks(text)
  const all: ParsedTx[] = []

  for (const block of blocks) {
    all.push(...parseBlock(block, vencimento))
  }

  // Deduplica global
  const seen = new Set<string>()
  const transactions: ParsedTx[] = []
  for (const t of all) {
    const key = `${t.purchase_date}|${t.description}|${t.amount_brl}|${t.installment}`
    if (seen.has(key)) continue
    seen.add(key)
    transactions.push(t)
  }

  return { payment_date, invoice_month, holder, card_last_four, total, transactions }
}