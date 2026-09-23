export type ParsedTx = {
  purchase_date: string  // YYYY-MM-DD
  description: string
  amount_brl: number
  category: string | null
}

export type ParsedInvoice = {
  payment_date: string  // YYYY-MM-DD
  invoice_month: string // YYYY-MM
  holder: string | null
  card_last_four: string | null
  total: number | null
  transactions: ParsedTx[]
}

/** Regexes pros 2 layouts que você tem */
const VENCIMENTO_1 = /Com vencimento em:\s*(\d{2})\/(\d{2})\/(\d{4})/i
const VENCIMENTO_2 = /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i
const HOLDER = /Titular\s+([A-Z][A-Z\s]+?)\s+Cart[ãa]o\s+([\d.X]+)/i
const TOTAL = /O total da sua fatura é:\s*R\$\s*([\d.,]+)/i

/** Linha de lançamento: "23/08 DESC 31,43" ou "23/08 DESC 1.792,70" */
const LINE = /(\d{2})\/(\d{2})\s+([A-Za-zÀ-ú][A-Za-z0-9\s*'.\-À-ú]{2,60}?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|-\d{1,3}(?:\.\d{3})*,\d{2})/g

/** Ignora essas linhas (cabeçalhos, totalizadores) */
const BLACKLIST = [
  /^total/i,
  /^lan[çc]amentos/i,
  /^pr[óo]xima fatura/i,
  /^demais faturas/i,
  /^pagamento/i,
  /^valor total/i,
  /^compras parceladas/i,
  /^resumo da fatura/i,
]

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseMoney(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

/** Decide o ano da compra dado o mês da compra e o mês do vencimento */
function inferYear(dia: number, mes: number, vencimento: Date): number {
  const yVenc = vencimento.getFullYear()
  const mVenc = vencimento.getMonth() + 1
  // Se o mês da compra é maior que o mês do vencimento, é do ano anterior
  // ex: compra 13/10, vencimento 08/09/2026 → compra 13/10/2025
  if (mes > mVenc) return yVenc - 1
  // Se for muito antes (6+ meses), pode ser ano anterior também
  if (mVenc - mes > 6) return yVenc - 1
  return yVenc
}

/** Categorização automática por palavra-chave */
function guessCategory(desc: string): string | null {
  const d = desc.toUpperCase()
  if (/UBER|99|DL\s|TAXI|POSTO|COMBUST|ESTACIONAM|CONCESSION|PEDÁGIO|AUTO BAN|CRB|ECOVIAS|EIXO/.test(d)) return 'Transporte'
  if (/SUPER|MERCAD|ASSAI|ATACAD|HIPER|MERCEARIA|PADARIA|BOLOS|JIM\.COM|SABOR|PAESE|CACAU|CHOCOLAT/.test(d)) return 'Supermercado'
  if (/RESTAUR|LANCH|PIZZA|BURGER|IFD\*|SUBWAY|DOMINO|COSTEL|ARABE|BONANZA|GRILL|FLYPAY|BOTECO|PANIFICADORA/.test(d)) return 'Alimentação'
  if (/DROGAR|FARMAC|RAIA|RDSAUDE|HOSPIT|H\.V\.B|PAGUEMENOS|HOSP|CL[ÍI]NICA|SAUDE/.test(d)) return 'Saúde'
  if (/PET\s?LOVE|PETZ|BICHO|PETLOVE/.test(d)) return 'Pet'
  if (/SKYFIT|ACADEM|CINEMARK|CINEMA|EVENTOS|INGRESSO|BORG|GALLERIA|URBANES|PRANA|DELTA FIT|CAPPTA/.test(d)) return 'Lazer'
  if (/APPLE|NETFLIX|SPOTIFY|AMAZON PRIME|HBOMAX|HBO MAX|DISNEY|GLOBOPLAY|MELIMAIS|PRIME B|PRIME CANAIS/.test(d)) return 'Assinaturas'
  if (/AMAZON|MERCADOLIVRE|SHOPEE|SHEIN|MAGAZ/.test(d)) return 'Outros'
  if (/CLARO|VIVO|TIM|OI |NET |SERVICOS CLA|TELEFON/.test(d)) return 'Telefonia'
  if (/VANS|CEA|RIACHUEL|DAFITI|MODA|VESTU|MY CURVES|L&B|L & B|LISO PERFEITO/.test(d)) return 'Vestuário'
  if (/DECOLAR|AZUL|LATAM|GOL |LOCAUTO|POUSADA|HOTEL|BOOKING|TURISMO|HOSTEL|VIAG/.test(d)) return 'Viagem'
  if (/ANUIDADE|ITA[ÚU] AVISA|IOF|TARIFA|MENSALID/.test(d)) return 'Tarifas'
  if (/AMAZON BR|AMAZON MARKET|EDUCAC|STORE|EC \*G|EC\*G/.test(d)) return 'Educação'
  if (/CONSTRU|LOJAS AMERICANAS|CASA|MADER|MATERIAL|BIG LAR|REDE DA CONSTRU/.test(d)) return 'Casa'
  if (/CONTABIL|ASA \*|ASA\*|SENHOR CONTAB|ARIESBARB|LISO PERF|PAGUE MENOS|SERVI[ÇC]OS/.test(d)) return 'Serviços'
  if (/RAIA DROG|PAGUE MENOS|FARMACIA PAG/.test(d)) return 'Farmácia'
  return null
}

export function parseItauPdf(text: string): ParsedInvoice {
  // 1. Pega vencimento (tenta os 2 padrões)
  let vencMatch = text.match(VENCIMENTO_1) || text.match(VENCIMENTO_2)
  if (!vencMatch) throw new Error('Não consegui achar a data de vencimento no PDF')

  const [, vd, vm, vy] = vencMatch
  const vencimento = new Date(parseInt(vy), parseInt(vm) - 1, parseInt(vd))
  const payment_date = toIso(parseInt(vy), parseInt(vm), parseInt(vd))
  const invoice_month = `${vy}-${vm}`

  // 2. Holder / final do cartão
  const holderMatch = text.match(HOLDER)
  const holder = holderMatch ? holderMatch[1].trim() : null
  const card_last_four = holderMatch ? holderMatch[2].replace(/[.\s]/g, '').slice(-4) : null

  // 3. Total
  const totalMatch = text.match(TOTAL)
  const total = totalMatch ? parseMoney(totalMatch[1]) : null

  // 4. Lançamentos
  const transactions: ParsedTx[] = []
  const seen = new Set<string>()

  let m: RegExpExecArray | null
  LINE.lastIndex = 0
  while ((m = LINE.exec(text)) !== null) {
    const [, dd, mm, desc, val] = m

    // Ignora linhas de cabeçalho
    if (BLACKLIST.some(rx => rx.test(desc.trim()))) continue

    const dia = parseInt(dd)
    const mes = parseInt(mm)
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

    const amount = parseMoney(val)
    // valor negativo no PDF significa estorno → positivo no nosso banco
    const amountBrl = -Math.abs(amount)

    const year = inferYear(dia, mes, vencimento)
    const purchase_date = toIso(year, mes, dia)

    // Chave de deduplicação (mesma linha lida 2x pelo regex)
    const key = `${purchase_date}|${desc}|${amountBrl}`
    if (seen.has(key)) continue
    seen.add(key)

    transactions.push({
      purchase_date,
      description: desc.trim().replace(/\s+/g, ' '),
      amount_brl: amountBrl,
      category: guessCategory(desc),
    })
  }

  return {
    payment_date,
    invoice_month,
    holder,
    card_last_four,
    total,
    transactions,
  }
}