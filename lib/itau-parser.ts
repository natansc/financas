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
// 1. BLOCOS — pares (início, fim) mapeados por você
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
 * Acha cada bloco no texto e devolve o conteúdo entre (start fim) do "início"
 * e o "fim". Suporta múltiplas ocorrências do mesmo bloco (Itaú repete).
 */
function sliceBlocks(text: string): string[] {
  const slices: string[] = []

  for (const { start, end } of BLOCKS) {
    start.lastIndex = 0
    let mStart: RegExpExecArray | null
    while ((mStart = start.exec(text)) !== null) {
      const from = mStart.index + mStart[0].length

      // procura o "end" a partir do início do bloco
      end.lastIndex = from
      const mEnd = end.exec(text)
      const to = mEnd ? mEnd.index : text.length

      // só considera se o trecho é razoável
      if (to - from > 10) slices.push(text.slice(from, to))

      // continua a busca do próximo start DEPOIS desse bloco
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
// 3. Categoria — pega do rodapé que o próprio Itaú coloca
// ============================================================
const ITAU_CATS: Record<string, string> = {
  'outros': 'Outros', 'outras': 'Outros', 'diversos': 'Outros',
  'supermercado': 'Supermercado', 'supermarket': 'Supermercado',
  'lazer': 'Lazer',
  'viagem': 'Viagem', 'viaagem': 'Viagem', 'hotel': 'Viagem',
  'veículos': 'Transporte', 'veiculos': 'Transporte', 'transporte': 'Transporte',
  'saúde': 'Saúde', 'saude': 'Saúde',
  'casa': 'Casa',
  'educação': 'Educação', 'educacao': 'Educação',
  'vestuário': 'Vestuário', 'vestuario': 'Vestuário',
  'serviços': 'Serviços', 'servicos': 'Serviços',
  'restaurante': 'Alimentação', 'alimentação': 'Alimentação', 'alimentacao': 'Alimentação',
  'farmácia': 'Farmácia', 'farmacia': 'Farmácia',
  'petshop': 'Pet', 'pet': 'Pet',
  'posto': 'Combustível', 'combustível': 'Combustível', 'combustivel': 'Combustível',
  'estacionamento': 'Transporte',
  'automobile': 'Outros',
  'turismo': 'Viagem',
  'hobby': 'Outros',
  'estudário': 'Educação', 'estudario': 'Educação',
}

function extractItauCategory(tail: string): string | null {
  if (!tail) return null
  const cleaned = tail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const parts = cleaned.split(/\s+/)
  for (const p of parts) {
    if (ITAU_CATS[p]) return ITAU_CATS[p]
    // tenta também com acento (fallback)
    if (ITAU_CATS[tail.split(/\s+/).find(x => x.toLowerCase() === p) || '']) {
      return ITAU_CATS[tail.split(/\s+/).find(x => x.toLowerCase() === p) || '']
    }
  }
  // fallback: tenta sem normalizar
  for (const p of tail.split(/\s+/)) {
    const direct = ITAU_CATS[p.toLowerCase()]
    if (direct) return direct
  }
  return null
}

// ============================================================
// 4. Extração de uma linha dentro de um bloco
// ============================================================
/**
 * Cada linha do Itaú (quando o texto é extraído) fica assim:
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
// 5. Header
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

  // Deduplica global (mesma compra pode aparecer 2x se bloco repetido)
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