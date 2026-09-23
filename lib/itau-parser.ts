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
// 0. Regex flexível — aceita espaço entre cada letra
// ============================================================
function flex(s: string): string {
  return s
    .split('')
    .map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*')
}

// ============================================================
// 1. Blocos — início e fim (mapeados por você)
// ============================================================
const BLOCKS: Array<{ start: RegExp; end: RegExp }> = [
  {
    start: new RegExp(flex('Lançamentos') + '\\s*:?\\s*' + flex('compras') + '\\s+' + flex('e') + '\\s+' + flex('saques'), 'gi'),
    end:   new RegExp(flex('Lançamentos') + '\\s+' + flex('no') + '\\s+' + flex('cartão'), 'gi'),
  },
  {
    start: new RegExp(flex('Lançamentos') + '\\s*:?\\s*' + flex('produtos') + '\\s+' + flex('e') + '\\s+' + flex('serviços'), 'gi'),
    end:   new RegExp(flex('Lançamentos') + '\\s+' + flex('produtos') + '\\s+' + flex('e') + '\\s+' + flex('serviços'), 'gi'),
  },
  {
    start: new RegExp(flex('Lançamentos') + '\\s+' + flex('internacionais'), 'gi'),
    end:   new RegExp(flex('Total') + '\\s+' + flex('transações') + '\\s+' + flex('inter'), 'gi'),
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

/** Aceita "2.540,18", "2.5 40, 18", "-3.046 ,10" */
function parseMoney(s: string): number {
  const clean = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(clean)
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
// 3. Categoria — só preenche o campo, não filtra
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

const ITAU_CATS: Record<string, string> = {
  'outros': 'Outros', 'outras': 'Outros', 'diversos': 'Outros',
  'supermercado': 'Supermercado', 'supermarket': 'Supermercado',
  'lazer': 'Lazer',
  'viagem': 'Viagem', 'viaagem': 'Viagem', 'hotel': 'Viagem', 'turismo': 'Viagem',
  'veiculos': 'Transporte', 'transporte': 'Transporte', 'estacionamento': 'Transporte',
  'saude': 'Saúde',
  'casa': 'Casa',
  'educacao': 'Educação', 'estudario': 'Educação',
  'vestuario': 'Vestuário',
  'servicos': 'Serviços',
  'restaurante': 'Alimentação', 'alimentacao': 'Alimentação',
  'farmacia': 'Farmácia',
  'petshop': 'Pet', 'pet': 'Pet',
  'posto': 'Combustível', 'combustivel': 'Combustível',
  'automobile': 'Outros', 'hobby': 'Outros',
}

const KEYWORD_RULES: Array<{ category: string; rx: RegExp }> = [
  { category: 'Supermercado', rx: /\b(SUPER\s?LIM|SUPERMERCADO|MERCADINHO|MERCEARIA|HIPER\s?10|HIPERMERCADO|CARREFOUR|ASSAI|ATACAD[ÃA]O|ATACADISTA|BRETAS|BIG\s?LAR|DIA\s?A\s?DIA|PAO\s?DE\s?ACUCAR|PADARIA|MINEIRAO|EPA\s|EXTRA\s|SAM\s?CLUB|MAKRO|BISTEK|VERDEMAR|NOSSO\s?ATACAD|DISTRIBUIDORA\s?BERNARDO|EMP[ÓO]RIO|FRIG\s?GOIAS|JIM\.COM|PAESE|ROYAL\s?TRUDEL|CACAU\s?SHOW|BISCOITOS|CASA\s?MARTINHO|SABOR\s?(SAUDE|ARABE)|PRO\s?CARNES|TONIOLO|ANDREAZZA)/i },
  { category: 'Alimentação', rx: /\b(RESTAURANTE|LANCHONETE|IFD\*|SUBWAY|DOMINO|BURGER|PIZZA|PIZZARIA|COSTEL[ÃA]O|GRILL|CHURRASCARIA|FLYPAY|BOTECO|GEORGIA|VALORI|MALBEC|CAFEEIRO|BONANZA|PRANA|VIANNA|DIETGYN|ESKINA|PROCAP|WEULERBLENIO|BITTEBURGUER|SENHOR\s?CONTABIL|PANIFICADORA|MC\s?DONALD|HABIB|GIRAFFAS|SPOLETO|KFC|BOB\s?S|OUTBACK|MADERO|RAGAZZO|STARBUCKS|CONFEITARIA|SORVETERIA|ACAI|MIGUELITO|MBRESTAURANTE)/i },
  { category: 'Saúde', rx: /\b(DROGARIA|FARM[AÁ]CIA|FARMACIA|RAIA\s?DROGASIL|DROGASIL|PAGUE\s?MENOS|PAGUEMENOS|RD\s?SA[UÚ]DE|RDSAUDE|HOSPITAL|HOSPIT|H\.V\.B|CL[ÍI]NICA|LABORAT[ÓO]RIO|UNIMED|AMIL|ODONTO|FARMALIVIA|DROGARIAS\s?PACHECO|DROGARIA\s?SP|G12ATACADO)/i },
  { category: 'Pet', rx: /\b(PET\s?LOVE|PETLOVE|PETZ|COBASI|BICHO\s?CHIC|AGROPET|PET\s?SHOP)/i },
  { category: 'Transporte', rx: /\b(UBER|99\s?(APP|TAXI|FOOD)?|DL\s?\*?\s?UBER|TAXI|ESTACIONAMENTO|CONCESSIONARIA|PED[ÁA]GIO|ECOVIAS|AUTO\s?BAN|EIXO\s?SP|CCR|ARTESP|MOVIDA|LOCALIZA|UNIDAS|RENTALCAR|POSTO\s|AUTO\s?POSTO|REDE\s?DITO|REDE\s?DE\s?POSTOS|CRB\s?FPAY|MARAJOCANAPOLIS|CONCEBRA|FLAMBOYANT|VE[ÍI]CULOS|ARARAQUARA|DELTADELTA)/i },
  { category: 'Viagem', rx: /\b(DECOLAR|AZUL\s?LINHAS|AZULVIA|LATAM|GOL\s?LINHAS|LOCAUTO|POUSADA|HOTEL|HOSTEL|BOOKING|TURISMO|URBANES|SP\s?HOLAFLY|AIRBNB|EXPEDIA|CVC|FLOT)/i },
  { category: 'Lazer', rx: /\b(SKYFIT|ACADEMIA|SMART\s?FIT|CINEMARK|CINEMA|INGRESSO|GALLERIA|BORGESE|DELTA\s?FIT|CAPPTA|TEATRO|MUSEU|AQU[ÁA]RIO|ZOOL[ÓO]GICO|JIM\.COM|BETO\s?CARRERO|SNOWLAND|MARIA\s?FUMA[CÇ]A|DESFILE|PRANA\s?EVENTOS)/i },
  { category: 'Assinaturas', rx: /\b(APPLE\.COM|APPLE\s?MUSIC|NETFLIX|SPOTIFY|DEEZER|AMAZON\s?PRIME|PRIME\s?VIDEO|HBOMAX|HBO\s?MAX|DISNEY|GLOBOPLAY|STAR\+|PARAMOUNT|CRUNCHYROLL|MELIMAIS|YOUTUBE\s?PREMIUM)/i },
  { category: 'Telefonia', rx: /\b(CLARO\s?FLEX|CLARO\s?NET|VIVO\s?FIBRA|VIVO\s?MÓVEL|TIM\s?LIVE|TIM\s?BLACK|OI\s?FIXO|OI\s?VELOX|NET\s?COMBO|SERVICOS\s?CLA|TELEFONIA)/i },
  { category: 'Vestuário', rx: /\b(VANS|CEA\s?MODAS|C&A|MY\s?CURVES|RIACHUELO|DAFITI|RENNER|MARISA|ZARA|SHEIN|SHOPEE|L\s?&\s?B|LISO\s?PERFEITO|MODA|VESTU[ÁA]RIO|MOLINA|AMOBELEZA|IMP[ÉE]RIOMODAMA|RZ\s?MODA|BELEZA\s?NA\s?WEB|NATURA|BOTIC[ÁA]RIO|AVON)/i },
  { category: 'Educação', rx: /\b(ALURA|UDEMY|HOTMART|ROCKETSEAT|ESCOLA|FACULDADE|UNIVERSIDADE|CURSO|EDUCAC|EDUCA[CÇ][ÃA]O|AMAZON\s?BR|AMAZON\s?MARKET|STORE\s?IMPACT|EC\s?\*?\s?G|CASA\s?DO\s?C[ÓO]DIGO|IMPACTA)/i },
  { category: 'Casa', rx: /\b(LEROY\s?MERLIN|TELHANORTE|C\s?&\s?C|MADER|MADEIREIRA|CONSTRU|MATERIAL\s?DE\s?CONSTRU|OBRAMAX|SODIMAC|MULTICOLOR\s?TINTAS|BIG\s?LAR|REDE\s?DA\s?CONSTRU|LOJAS\s?AMERICANAS|CASAS\s?BAHIA|MOBILIA|M[ÓO]VEIS|CASA\s?MARTINHO|TOK\s?STOK|CAMICADO)/i },
  { category: 'Tarifas', rx: /\b(ANUIDADE|ITA[ÚU]\s?AVISA|IOF|TARIFA|MENSALIDADE|JUROS|MULTA|ENCARGO)/i },
  { category: 'Serviços', rx: /\b(ARIESBARB|BARBEARIA|SAL[ÃA]O|CABELEIREIR|MANICURE|EST[ÉE]TICA|TATUAGEM|CONTABIL|SENHOR\s?CONTABIL|WELLINGTON|JANAINA|WESLEY|DANIEL\s?RIBEIRO|AAUCENA|INOVAR\s?COSMETIC|MISS\s?MAKE|LISO\s?PERFEITO)/i },
]

function extractItauCategory(tail: string): string | null {
  if (!tail) return null
  const parts = normalize(tail).split(/\s+/)
  for (const p of parts) {
    if (ITAU_CATS[p]) return ITAU_CATS[p]
  }
  return null
}

function categorizeByKeywords(desc: string): string | null {
  if (!desc) return null
  const d = desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  for (const r of KEYWORD_RULES) {
    if (r.rx.test(d)) return r.category
  }
  return null
}

/** Só preenche o campo `category` do resultado. NÃO decide se a linha entra. */
function resolveCategory(itauCat: string | null, desc: string): string | null {
  if (itauCat && itauCat.toLowerCase() !== 'outros') return itauCat
  return categorizeByKeywords(desc)
}

// ============================================================
// 4. Extração — sem filtro por descrição
// ============================================================
/**
 * Regex captura "DD/MM + descrição + valor". O valor é a âncora.
 * Aceita:
 *   - "23/08" e "2 3 / 0 8"
 *   - valor "31,43" ou "2.5 40, 18" ou "-3.046 ,10"
 *   - rabo opcional (categoria + cidade)
 */
const RE_TX = /(\d{2})\s*\/\s*(\d{2})([\s\S]{1,300}?)(-?\d[\d.\s]*?,\s*\d{2})\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{0,60})?/g

function parseBlock(block: string, vencimento: Date): ParsedTx[] {
  const txs: ParsedTx[] = []

  RE_TX.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = RE_TX.exec(block)) !== null) {
    const [, dd, mm, rawDesc, rawVal, tail] = m

    const dia = +dd
    const mes = +mm
    // ÚNICA validação: data precisa ser plausível.
    // Sem isso, "13/10" de "13/10/2025" seria interpretado como 10/13.
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

    // Junta letras soltas: "La nça me nt os" → "Lançamentos"
    const desc = rawDesc
      .replace(/\b([A-Za-zÀ-ú])\s+(?=[A-Za-zÀ-ú]\b)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()

    // Valor: limpa espaços e faz parse. Se não for número, pula.
    const pdfValue = parseMoney(rawVal)
    if (isNaN(pdfValue)) continue

    // PDF mostra compras positivas, estornos negativos.
    // Banco ao contrário → nega.
    const amountBrl = -pdfValue

    const year = inferYear(dia, mes, vencimento)
    const purchase_date = toIso(year, mes, dia)

    const installment = extractInstallment(desc)
    const cleanDesc = installment !== 'Única' ? stripInstallment(desc) : desc

    const itauCat = extractItauCategory(tail || '')
    const category = resolveCategory(itauCat, cleanDesc)

    txs.push({
      purchase_date,
      description: cleanDesc || '(sem descrição)',
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
const RE_VENC_LIST = [
  /Com vencimento em\s*:?\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
  /Vencimento\s*:?\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
  /Vencto\s*:?\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
  /Venc\.\s*:?\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
]

const RE_HOLD  = /Titular\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+Cart/i
const RE_CARD  = /Cart[ãa]o\s+([\d.X]+)/i
const RE_TOTAL = /total da sua fatura é\s*:?\s*R\$\s*([\d.,\s]+)/i

// ============================================================
// 6. Função principal — nunca lança exceção
// ============================================================
export function parseItauPdf(rawText: string): ParsedInvoice {
  const text = rawText.normalize('NFC')

  let venc: RegExpMatchArray | null = null
  for (const rx of RE_VENC_LIST) {
    venc = text.match(rx)
    if (venc) break
  }

  let payment_date = ''
  let invoice_month = ''
  if (venc) {
    const [, vd, vm, vy] = venc
    payment_date = toIso(+vy, +vm, +vd)
    invoice_month = `${vy}-${vm}`
  } else {
    const now = new Date()
    payment_date = toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
    invoice_month = payment_date.slice(0, 7)
  }

  const vencimentoDate = new Date(payment_date + 'T00:00:00')

  const holder = (text.match(RE_HOLD)?.[1] || '').trim() || null
  const card_last_four =
    (text.match(RE_CARD)?.[1] || '').replace(/[.\sX]/g, '').slice(-4) || null

  const totalMatch = text.match(RE_TOTAL)
  const total = totalMatch ? parseMoney(totalMatch[1]) : null

  const blocks = sliceBlocks(text)
  const transactions: ParsedTx[] = []
  for (const b of blocks) transactions.push(...parseBlock(b, vencimentoDate))

  return { payment_date, invoice_month, holder, card_last_four, total, transactions }
}