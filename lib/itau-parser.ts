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

// ---------- Header ----------
const VENCIMENTO_1 = /Com vencimento em:\s*(\d{2})\/(\d{2})\/(\d{4})/i
const VENCIMENTO_2 = /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i
const HOLDER = /Titular\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s+Cart[ãa]o\s+([\d.X]+)/i
const TOTAL = /O total da sua fatura é:\s*R\$\s*([\d.,]+)/i

// ---------- Marcadores de seção ----------
// Cada seção começa com um header e termina no próximo header (ou fim)
const SECTION_STARTS: Array<{ key: string; regex: RegExp; parse: boolean }> = [
  { key: 'pagamentos',  regex: /Pagamentos efetuados/i,                          parse: false },
  { key: 'compras',     regex: /Lan[çc]amentos:\s*compras e saques/i,             parse: true  },
  { key: 'produtos',    regex: /Lan[çc]amentos:\s*produtos e servi[çc]os/i,       parse: true  },
  { key: 'contario',    regex: /Lan[çc]amentos:\s*cont[áa]rio/i,                  parse: true  },
  { key: 'nocard',      regex: /Lan[çc]amentos no cart[ãa]o/i,                    parse: false },
  { key: 'total',       regex: /Total dos lan[çc]amentos atuais/i,                parse: false },
  { key: 'parceladas',  regex: /Compras parceladas\s*-\s*pr[óo]ximas faturas/i,   parse: false },
  { key: 'limites',     regex: /Limites de cr[ée]dito/i,                          parse: false },
  { key: 'encargos',    regex: /Encargos cobrados nesta fatura/i,                 parse: false },
]

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseMoney(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

function inferYear(dia: number, mes: number, vencimento: Date): number {
  const yV = vencimento.getFullYear()
  const mV = vencimento.getMonth() + 1
  // Se compra é em mês posterior ao vencimento, é ano anterior (ex: compra out/2025, venc set/2026)
  if (mes > mV) return yV - 1
  return yV
}

/** Descobre o installment a partir da descrição (ex: "10/12" → "10/12") */
function extractInstallment(desc: string): string {
  // Procura padrão "X/Y" onde Y é entre 2 e 24 (indício de parcelamento)
  const m = desc.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (m) {
    const n = parseInt(m[1]); const total = parseInt(m[2])
    if (total >= 2 && total <= 24 && n >= 1 && n <= total) {
      return `${n}/${total}`
    }
  }
  return 'Única'
}

/** Remove o "X/Y" da descrição pra não duplicar */
function stripInstallment(desc: string): string {
  return desc.replace(/\s*\b\d{1,2}\/\d{1,2}\b\s*$/, '').trim()
}

/** Categorização automática por keyword */
function guessCategory(desc: string): string | null {
  const d = desc.toUpperCase()
  if (/UBER|99\s|DL\s*\*?UBER|TAXI|POSTO|COMBUST|ESTACIONAM|CONCESSION|PED[ÁA]GIO|AUTO BAN|CRB FPAY|ECOVIAS|EIXO SP|ARARAQUARA|AUTO POSTO|POSTO SHELL|POSTO GEMA|POSTO KARAKA|POSTO TALISMA|POSTO BANDEIRANTE|POSTO PORTO|REDE DITO|REDE DE POSTOS|MARAJOCANAPOLIS|DELTADELTA/.test(d)) return 'Transporte'
  if (/SUPER|MERCAD|ASSAI|ATACAD|HIPER|MERCEARIA|PADARIA|PAES|CACAU|CHOCOLAT|FESTIVAL DELLA PASTA|ROYAL TRUDEL|BISCOITOS|MBRESTAURANTE|PRO CARNES|FRIG GOIAS|JIM\.COM|CASA MARTINHO/.test(d)) return 'Supermercado'
  if (/RESTAUR|LANCH|PIZZA|BURGER|IFD\*|SUBWAY|DOMINO|COSTEL|ARABE|BONANZA|GRILL|FLYPAY|BOTECO|PANIFICADORA|GEORGIA|VALORI|MALBEC|SEU CAFEEIRO|BEHONEST|T K BONSAI|DIETGYN|ESKINA|PROCAP|PRANA|VIANNA|T\. K\.|SA BOR|CHURRASCARIA|MIGUELITO|PANIFICADORA|WEULERBLENIO|EMPORIO 71|EMPORIO GUARAPUDO|MP \*TEMPERO|MP \*EMP[ÓO]RIO|MP \*LADOLESTE|MP \*WE PINK|MP \*LIVELO|MP \*MAURO|MP \*ARIES|MP \*MELIMAIS|MP \*REIDOCHURRASC|MP \*CAPIRINHA|IFD\*DESCMAIS|IFD\*LSJ|IFD\*VIANNA|IFD\*SABOR|IFD\*JUST|IFD\*BETA|IFD\*CASERATTO|IFD\*COMPANHIA/.test(d)) return 'Alimentação'
  if (/DROGAR|FARMAC|RAIA|RDSAUDE|HOSPIT|H\.V\.B|PAGUEMENOS|PAGUE MENOS|CL[ÍI]NICA|SAUDE|SA[ÚU]DE|FARMALIVIA|PRO CARNES|G12ATACADO/.test(d)) return 'Saúde'
  if (/PET\s?LOVE|PETZ|BICHO|PETLOVE/.test(d)) return 'Pet'
  if (/SKYFIT|ACADEM|CINEMARK|CINEMA|INGRESSO|GALLERIA|URBANES|DELTA FIT|CAPPTA|PRANA EVENTOS|JIM\.COM\*TAVERNA|JIM\.COM\*492/.test(d)) return 'Lazer'
  if (/APPLE|NETFLIX|NET FLIX|SPOTIFY|AMAZON PRIME|HBOMAX|HBO MAX|DISNEY|GLOBOPLAY|MELIMAIS|PRIME B|PRIME CANAIS|MELIMAISOS|MELIMAIS OS/.test(d)) return 'Assinaturas'
  if (/AMAZON|MERCADOLIVRE|SHOPEE|SHEIN|MAGAZ|ALIEXPRESS/.test(d)) return 'Outros'
  if (/CLARO|VIVO|TIM|SERVICOS CLA|TELEFON/.test(d)) return 'Telefonia'
  if (/VANS|CEA |MODA|VESTU|MY CURVES|L & B|L\s*&\s*B|LISO PERFEITO|LOJAS RIACHUEL|DAFITI|ZP \*SOLUTI|VINDI|BELEZA NA WEB|INOVAR COSMETIC|MISS MAKE|AMOBELEZA/.test(d)) return 'Vestuário'
  if (/DECOLAR|AZUL|LATAM|GOL |LOCAUTO|POUSADA|HOTEL|BOOKING|TURISMO|HOSTEL|VIAG|UBER\*TRIP|SP HOLAFLY|AZULVIA|HP \*|H\.V\.B/.test(d)) return 'Viagem'
  if (/ANUIDADE|ITA[ÚU] AVISA|IOF|TARIFA|MENSALID/.test(d)) return 'Tarifas'
  if (/AMAZON BR|AMAZON MARKET|EDUCAC|STORE IMPACT|EC \*G|EC\*G|ALURA|UDEMY|HOTMART/.test(d)) return 'Educação'
  if (/CONSTRU|LOJAS AMERICANAS|MADER|MATERIAL|BIG LAR|REDE DA CONSTRU|MULTICOLOR TINTAS|MOBILIA/.test(d)) return 'Casa'
  if (/CONTABIL|ASA \*|ASA\*|SENHOR CONTAB|ARIESBARB|A[ÁA]UCENA|LISO PERF|SERVI[ÇC]OS|DANIEL RIBEIRO|WELLINGTON|JANAINA|WESLEY/.test(d)) return 'Serviços'
  if (/LGPD|CONS[ÓO]RCIO|EMPR[ÉE]STIMO/.test(d)) return 'Consórcio'
  return null
}

/** Fatia o texto nas seções corretas */
function sliceSections(text: string): string[] {
  // Acha posições de cada section header
  const matches: Array<{ idx: number; len: number; parse: boolean }> = []
  for (const s of SECTION_STARTS) {
    const re = new RegExp(s.regex.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      matches.push({ idx: m.index, len: m[0].length, parse: s.parse })
    }
  }
  matches.sort((a, b) => a.idx - b.idx)

  // Fatia entre cada header
  const sections: string[] = []
  for (let i = 0; i < matches.length; i++) {
    if (!matches[i].parse) continue
    const start = matches[i].idx + matches[i].len
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length
    sections.push(text.slice(start, end))
  }
  return sections
}

/** Regex que casa "DD/MM [desc] valor" com o valor como âncora */
// desc: começa com letra maiúscula ou * e vai até encontrar o valor
// valor: -?1.234,56
const TX_REGEX = /(\d{2})\/(\d{2})([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\s\S]{2,90}?)(-?\d{1,3}(?:\.\d{3})*,\d{2})/g

/** Ignora linhas que são claramente cabeçalho ou subtotal */
const BLACKLIST = [
  /^data\b/i, /^estabelecimento/i, /^valor em/i, /^total\b/i,
  /^lan[çc]amento/i, /^lan[çc]amentos/i, /^pr[óo]xima fatura/i,
  /^demais faturas/i, /^pagamento/i, /^resumo/i, /^valor total/i,
  /^compras parceladas/i, /^limite/i, /^encargos/i, /^juros/i,
  /^multa/i, /^iof/i, /^cr[ée]dito rotativo/i, /^novo teto/i,
  /^simula/i, /^de retirada/i, /^de pagamento/i, /^fique atento/i,
  /^juros m[áa]ximos/i, /^ao contratar/i, /^essa fatura/i, /^saldo/i,
]

export function parseItauPdf(text: string): ParsedInvoice {
  const vencMatch = text.match(VENCIMENTO_1) || text.match(VENCIMENTO_2)
  if (!vencMatch) throw new Error('Vencimento não encontrado no PDF')

  const [, vd, vm, vy] = vencMatch
  const vencimento = new Date(parseInt(vy), parseInt(vm) - 1, parseInt(vd))
  const payment_date = toIso(parseInt(vy), parseInt(vm), parseInt(vd))
  const invoice_month = `${vy}-${vm}`

  const holderMatch = text.match(HOLDER)
  const holder = holderMatch ? holderMatch[1].trim() : null
  const card_last_four = holderMatch ? holderMatch[2].replace(/[.\sX]/g, '').slice(-4) : null

  const totalMatch = text.match(TOTAL)
  const total = totalMatch ? parseMoney(totalMatch[1]) : null

  // 1. Fatia nas seções
  const sections = sliceSections(text)

  // 2. Extrai de cada seção
  const txs: ParsedTx[] = []
  const seen = new Set<string>()

  for (const section of sections) {
    TX_REGEX.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TX_REGEX.exec(section)) !== null) {
      const [, dd, mm, rawDesc, rawVal] = m

      const desc = rawDesc.trim().replace(/\s+/g, ' ')
      if (BLACKLIST.some(rx => rx.test(desc))) continue
      if (desc.length < 3) continue

      const dia = parseInt(dd); const mes = parseInt(mm)
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue

      const amount = parseMoney(rawVal)
      const amountBrl = -Math.abs(amount) // valores positivos no PDF = despesa

      const year = inferYear(dia, mes, vencimento)
      const purchase_date = toIso(year, mes, dia)

      const installment = extractInstallment(desc)
      const cleanDesc = installment !== 'Única' ? stripInstallment(desc) : desc

      const key = `${purchase_date}|${cleanDesc}|${amountBrl}|${installment}`
      if (seen.has(key)) continue
      seen.add(key)

      txs.push({
        purchase_date,
        description: cleanDesc,
        amount_brl: amountBrl,
        category: guessCategory(cleanDesc),
        installment,
      })
    }
  }

  return { payment_date, invoice_month, holder, card_last_four, total, transactions: txs }
}