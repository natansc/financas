/**
 * Categorização por palavra-chave.
 * Só roda como FALLBACK — quando o Itaú mandou "Outros" ou nada.
 */

type Rule = { category: string; rx: RegExp }

/** Ordem importa: primeira regra que casar vence */
const RULES: Rule[] = [
  // Mercados / supermercados / atacados
  { category: 'Supermercado', rx: /\b(SUPER\s?LIM|SUPERMERCADO|MERCADINHO|MERCEARIA|HIPER\s?10|HIPERMERCADO|CARREFOUR|ASSAI|ASSAÍ|ATACAD[ÃA]O|ATACADISTA|BRETAS|BIG\s?LAR|DIA\s?A\s?DIA|PA[ÃA]O\s?DE\s?A[CÇ][UÚ]CAR|PADARIA|PÃO\s?DE\s?AÇÚCAR|MINEIR[ÃA]O|EPA\s|EXTRA\s|SAMS\s?CLUB|MAKRO|BISTEK|VERDEMAR|SUPER\s?NOSSO|NOSSO\s?ATACAD|HIPER\s?MAIS|DISTRIBUIDORA\s?BERNARDO|MERCADO\s?LIVRE|MERCADO\s?DO\s?POVO|EMP[ÓO]RIO\s?(VIDA|MURO|71|GUARAPUDO)|FRIG\s?GOIAS|JIM\.COM\s?\*?\s?\d|PAESE|ROYAL\s?TRUDEL|CACAU\s?SHOW|BISCOITOS|CHOCOLATARIA|CASA\s?MARTINHO|SABOR\s?(SAUDE|ARABE)|PRO\s?CARNES|SAM\s?CLUB|TONIOLO|ANDREAZZA|BOA\s?COMPRA|SUPER\s?[A-Z])/i },

  // Alimentação / restaurante
  { category: 'Alimentação', rx: /\b(RESTAURANTE|LANCHONETE|IFD\*|SUBWAY|DOMINO|BURGER|PIZZA|PIZZARIA|COSTEL[ÃA]O|GRILL|CHURRASCARIA|FLYPAY|BOTECO|GEORGIA|VALORI|MALBEC|CAFEEIRO|BONANZA|PRANA|VIANNA|T\s?K\s?BONSAI|DIETGYN|ESKINA|PROCAP|WEULERBLENIO|SABOR\s?ARABE|BITTEBURGUER|JUST\s?BURGER|SENHOR\s?CONTABIL|PANIFICADORA|PADARIA|DOG\s?|BURGER\s?KING|MC\s?DONALD|MCDONALD|HABIB|GIRAFFAS|SPOLETO|KFC|BOB\s?S|PIZZA\s?HUT|OUTBACK|MADERO|RAGAZZO|AMPM|CACAU\s?SHOW|STARBUCKS|CAFÉ\s|CAFE\s|CONFEITARIA|SORVETERIA|ACAI|A[CÇ]A[ÍI]|LANCHES|GRILL|BAR\s)/i },

  // Saúde / farmácia
  { category: 'Saúde', rx: /\b(DROGARIA|FARM[AÁ]CIA|FARMACIA|RAIA\s?DROGASIL|DROGASIL|PAGUE\s?MENOS|PAGUEMENOS|RD\s?SA[UÚ]DE|RDSAUDE|HOSPITAL|HOSPIT|H\.V\.B|CL[ÍI]NICA|LABORAT[ÓO]RIO|UNIMED|AMIL|BRADESCO\s?SA[UÚ]DE|SULAM[ÉE]RICA|ODONTO|DENTISTA|FARMALIVIA|DROGARIAS\s?PACHECO|DROGARIA\s?SP)/i },

  // Pet
  { category: 'Pet', rx: /\b(PET\s?LOVE|PETLOVE|PETZ|COBASI|BICHO\s?CHIC|PETS?\s?|AGROPET|PET\s?SHOP|AMIGO\s?FIEL)/i },

  // Transporte / combustível / pedágio
  { category: 'Transporte', rx: /\b(UBER|99\s?(APP|TAXI|FOOD)?|DL\s?\*?\s?UBER|TAXI|ESTACIONAMENTO|ESTACIONAMENTOS|SEM\s?PARAR|ZUL\s?|CONCESSIONARIA|PED[ÁA]GIO|ECOVIAS|AUTO\s?BAN|EIXO\s?SP|CCR|ARTESP|MOVIDA|LOCALIZA|UNIDAS|RENTALCAR|POSTO\s?|AUTO\s?POSTO|REDE\s?DITO|REDE\s?DE\s?POSTOS|CRB\s?FPAY|AUTO\s?POSTO|MARAJOCANAPOLIS|CONCEBRA|FLAMBOYANT|VE[ÍI]CULOS)/i },

  // Viagem
  { category: 'Viagem', rx: /\b(DECOLAR|AZUL\s?LINHAS|AZULVIA|LATAM|GOL\s?LINHAS|LOCAUTO|POUSADA|HOTEL|HOSTEL|BOOKING\.COM|BOOKING\s?COM|TURISMO|URBANES|SP\s?HOLAFLY|AIRBNB|EXPEDIA|CVC|VIAJES|FLOT|DESCOMPLICA)/i },

  // Lazer / entretenimento
  { category: 'Lazer', rx: /\b(SKYFIT|ACADEMIA|SMART\s?FIT|CINEMARK|CINEMA|INGRESSO|GALLERIA|PARQUE\s?|BORGESE|DELTA\s?FIT|CAPPTA|NET\s?FLIX\s?SHOW|SHOWS?|TEATRO|MUSEU|AQU[ÁA]RIO|ZOOL[ÓO]GICO|JIM\.COM\s?\*?\s?TAVERNA|JIM\.COM\s?\*?\s?492|CEA\s?MUNDO|BETO\s?CARRERO|PARQUE\s?DINOSSAURO|SNOWLAND|MARIA\s?FUMA[CÇ]A|DESFILE\s?DE\s?NATAL)/i },

  // Assinaturas / streaming
  { category: 'Assinaturas', rx: /\b(APPLE\.COM|APPLE\s?MUSIC|NETFLIX|SPOTIFY|DEEZER|AMAZON\s?PRIME|PRIME\s?VIDEO|HBOMAX|HBO\s?MAX|DISNEY\s?\+?|DISNEYPLUS|GLOBOPLAY|STAR\+|PARAMOUNT|CRUNCHYROLL|MELIMAIS|AMAZON\s?MUSIC|YOUTUBE\s?PREMIUM|APLICATIVO)/i },

  // Telefonia / internet
  { category: 'Telefonia', rx: /\b(CLARO\s?FLEX|CLARO\s?NET|VIVO\s?FIBRA|VIVO\s?MÓVEL|VIVO\s?MOVEL|TIM\s?LIVE|TIM\s?BLACK|OI\s?FIXO|OI\s?VELOX|NET\s?COMBO|SERVICOS\s?CLA|TELEFONIA)/i },

  // Vestuário
  { category: 'Vestuário', rx: /\b(VANS|CEA\s?MODAS|C&A|MY\s?CURVES|RIACHUELO|LOJAS\s?RIACHUEL|DAFITI|RENNER|MARISA|ZARA|H&M|FOREVER\s?21|SHEIN|SHOPEE\s?\*?\s?(SHEIN|VAL\s?TERENXOVIAS|RIVENBAZAR|FOREVERLISS)|L\s?&\s?B\s?E\-COMMER|L&B|LISO\s?PERFEITO|MODA\s?|VESTU[ÁA]RIO|MOLINA|AMOBELEZA|IMP[ÉE]RIOMODAMA|RZ\s?MODA|BELEZA\s?NA\s?WEB|NATURA|BOTIC[ÁA]RIO|O\s?BOTICARIO|AVON|MARY\s?KAY)/i },

  // Educação
  { category: 'Educação', rx: /\b(ALURA|UDEMY|HOTMART|ROCKETSEAT|ALURA|ESCOLA|FACULDADE|UNIVERSIDADE|PUC|USP|UNIP|EST[ÁA]CIO|P[ÓO]S\s?|CURSO|EDUCAC|EDUCA[CÇ][ÃA]O|AMAZON\s?BR|AMAZON\s?MARKET|STORE\s?IMPACT|EC\s?\*?\s?G|EC\s?\*?\s?MELIMAIS|CASA\s?DO\s?C[ÓO]DIGO|IMPACTA|DIO\s?|DEV\s?MEDIA)/i },

  // Casa / construção
  { category: 'Casa', rx: /\b(LEROY\s?MERLIN|TELHANORTE|C\s?&\s?C|MADER|MADEIREIRA|CONSTRU|MATERIAL\s?DE\s?CONSTRU|OBRAMAX|SODIMAC|MULTICOLOR\s?TINTAS|BIG\s?LAR|REDE\s?DA\s?CONSTRU|LOJAS\s?AMERICANAS|CASAS\s?BAHIA|MOBILIA|M[ÓO]VEIS|CASA\s?\&|CASA\s?\&\s?VIDEO|TOK\s?\&?\s?STOK|CAMICADO)/i },

  // Assinaturas / tarifas de cartão
  { category: 'Tarifas', rx: /\b(ANUIDADE|ITA[ÚU]\s?AVISA|IOF|TARIFA|MENSALIDADE|JUROS|MULTA|ENCARGO)/i },

  // Serviços gerais
  { category: 'Serviços', rx: /\b(ARIESBARB|BARBEARIA|SAL[ÃA]O|CABELEIREIR[OA]|MANICURE|EST[ÉE]TICA|TATUAGEM|CONTABIL|SENHOR\s?CONTABIL|WELLINGTON|JANAINA|WESLEY|DANIEL\s?RIBEIRO|AAUCENA|SERVI[CÇ]OS\s?|INOVAR\s?COSMETIC|MISS\s?MAKE)/i },
]

/** Normaliza (maiúsculas, sem acento, sem pontuação extra) */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function categorizeByKeywords(description: string): string | null {
  if (!description) return null
  const d = normalize(description)
  for (const rule of RULES) {
    if (rule.rx.test(d)) return rule.category
  }
  return null
}

/**
 * Decide a categoria final:
 *  1. Se `itauCategory` veio preenchida E não é "Outros" → usa ela
 *  2. Senão, tenta por palavra-chave
 *  3. Senão, devolve null
 */
export function resolveCategory(
  itauCategory: string | null | undefined,
  description: string
): string | null {
  if (itauCategory && itauCategory.toLowerCase() !== 'outros') {
    return itauCategory
  }
  return categorizeByKeywords(description)
}