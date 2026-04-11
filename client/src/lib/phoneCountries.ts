export interface CountryPhone {
  code: string;
  name: string; // nome em português
  ddi: string; // apenas dígitos, ex: "55"
  flag: string; // emoji
  mask: string; // "#" = dígito, resto = literal
  maxDigits: number; // máx de dígitos locais
}

/** Aplica uma máscara de caracteres '#' sobre uma string de dígitos. */
export function applyPhoneMask(digits: string, mask: string): string {
  let result = "";
  let di = 0;
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === "#") {
      result += digits[di++];
    } else {
      result += mask[i];
    }
  }
  return result;
}

function maxFromMask(mask: string): number {
  return mask.split("").filter(c => c === "#").length;
}

function c(
  code: string,
  name: string,
  ddi: string,
  flag: string,
  mask: string
): CountryPhone {
  return { code, name, ddi, flag, mask, maxDigits: maxFromMask(mask) };
}

// ─── América do Sul ───────────────────────────────────────────────────────────
const BR = c("BR", "Brasil", "55", "🇧🇷", "(##) #####-####");
const AR = c("AR", "Argentina", "54", "🇦🇷", "(###) ###-####");
const CL = c("CL", "Chile", "56", "🇨🇱", "# ####-####");
const CO = c("CO", "Colômbia", "57", "🇨🇴", "### ###-####");
const PE = c("PE", "Peru", "51", "🇵🇪", "### ### ###");
const VE = c("VE", "Venezuela", "58", "🇻🇪", "####-#######");
const UY = c("UY", "Uruguai", "598", "🇺🇾", "# ### ## ##");
const PY = c("PY", "Paraguai", "595", "🇵🇾", "### ######");
const BO = c("BO", "Bolívia", "591", "🇧🇴", "# ### ####");
const EC = c("EC", "Equador", "593", "🇪🇨", "## ### ####");

// ─── América do Norte / Central ───────────────────────────────────────────────
const US = c("US", "Estados Unidos", "1", "🇺🇸", "(###) ###-####");
const CA = c("CA", "Canadá", "1", "🇨🇦", "(###) ###-####");
const MX = c("MX", "México", "52", "🇲🇽", "## #### ####");
const PA = c("PA", "Panamá", "507", "🇵🇦", "#### ####");
const CR = c("CR", "Costa Rica", "506", "🇨🇷", "#### ####");
const CU = c("CU", "Cuba", "53", "🇨🇺", "# ### ####");
const DO = c("DO", "República Dom.", "1", "🇩🇴", "(###) ###-####");
const GT = c("GT", "Guatemala", "502", "🇬🇹", "#### ####");

// ─── Europa ───────────────────────────────────────────────────────────────────
const PT = c("PT", "Portugal", "351", "🇵🇹", "### ### ###");
const ES = c("ES", "Espanha", "34", "🇪🇸", "### ### ###");
const FR = c("FR", "França", "33", "🇫🇷", "## ## ## ## ##");
const GB = c("GB", "Reino Unido", "44", "🇬🇧", "##### ######");
const DE = c("DE", "Alemanha", "49", "🇩🇪", "#### #######");
const IT = c("IT", "Itália", "39", "🇮🇹", "### ### ####");
const NL = c("NL", "Holanda", "31", "🇳🇱", "## ### ####");
const BE = c("BE", "Bélgica", "32", "🇧🇪", "### ## ## ##");
const CH = c("CH", "Suíça", "41", "🇨🇭", "## ### ## ##");
const AT = c("AT", "Áustria", "43", "🇦🇹", "### ######");
const SE = c("SE", "Suécia", "46", "🇸🇪", "## ### ## ##");
const NO = c("NO", "Noruega", "47", "🇳🇴", "## ## ## ##");
const DK = c("DK", "Dinamarca", "45", "🇩🇰", "## ## ## ##");
const FI = c("FI", "Finlândia", "358", "🇫🇮", "## ### ## ##");
const PL = c("PL", "Polônia", "48", "🇵🇱", "### ### ###");
const RU = c("RU", "Rússia", "7", "🇷🇺", "### ###-##-##");
const UA = c("UA", "Ucrânia", "380", "🇺🇦", "## ### ## ##");
const GR = c("GR", "Grécia", "30", "🇬🇷", "### ### ####");
const RO = c("RO", "Romênia", "40", "🇷🇴", "### ### ###");
const CZ = c("CZ", "Tchéquia", "420", "🇨🇿", "### ### ###");
const HU = c("HU", "Hungria", "36", "🇭🇺", "## ### ####");
const IE = c("IE", "Irlanda", "353", "🇮🇪", "## ### ####");

// ─── Oriente Médio / África ───────────────────────────────────────────────────
const IL = c("IL", "Israel", "972", "🇮🇱", "##-###-####");
const AE = c("AE", "Emirados", "971", "🇦🇪", "## ### ####");
const SA = c("SA", "Arábia Saud.", "966", "🇸🇦", "## ### ####");
const TR = c("TR", "Turquia", "90", "🇹🇷", "### ### ## ##");
const ZA = c("ZA", "África do Sul", "27", "🇿🇦", "## ### ####");
const NG = c("NG", "Nigéria", "234", "🇳🇬", "## #### ####");
const EG = c("EG", "Egito", "20", "🇪🇬", "### ### ####");
const MA = c("MA", "Marrocos", "212", "🇲🇦", "## ## ## ##");
const AO = c("AO", "Angola", "244", "🇦🇴", "### ### ###");
const MZ = c("MZ", "Moçambique", "258", "🇲🇿", "## ### ####");

// ─── Ásia / Oceania ───────────────────────────────────────────────────────────
const JP = c("JP", "Japão", "81", "🇯🇵", "##-####-####");
const CN = c("CN", "China", "86", "🇨🇳", "### #### ####");
const IN = c("IN", "Índia", "91", "🇮🇳", "##### #####");
const KR = c("KR", "Coreia do S.", "82", "🇰🇷", "##-####-####");
const SG = c("SG", "Singapura", "65", "🇸🇬", "#### ####");
const HK = c("HK", "Hong Kong", "852", "🇭🇰", "#### ####");
const TH = c("TH", "Tailândia", "66", "🇹🇭", "##-####-####");
const PH = c("PH", "Filipinas", "63", "🇵🇭", "### ### ####");
const VN = c("VN", "Vietnã", "84", "🇻🇳", "### ### ###");
const ID = c("ID", "Indonésia", "62", "🇮🇩", "###-####-####");
const MY = c("MY", "Malásia", "60", "🇲🇾", "##-#### ####");
const AU = c("AU", "Austrália", "61", "🇦🇺", "#### ### ###");
const NZ = c("NZ", "Nova Zelândia", "64", "🇳🇿", "## ### ####");

export const COUNTRIES: CountryPhone[] = [
  // Brasil sempre primeiro
  BR,
  // Resto em ordem alfabética
  AE,
  AO,
  AR,
  AT,
  AU,
  BE,
  BO,
  BR,
  CA,
  CH,
  CL,
  CN,
  CO,
  CR,
  CU,
  CZ,
  DE,
  DK,
  DO,
  EC,
  EG,
  ES,
  FI,
  FR,
  GB,
  GR,
  GT,
  HK,
  HU,
  ID,
  IE,
  IL,
  IN,
  IT,
  JP,
  KR,
  MA,
  MX,
  MY,
  MZ,
  NG,
  NL,
  NO,
  NZ,
  PA,
  PE,
  PH,
  PL,
  PT,
  PY,
  RO,
  RU,
  SA,
  SE,
  SG,
  TH,
  TR,
  UA,
  US,
  UY,
  VE,
  VN,
  ZA,
].filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i); // deduplica (BR aparece uma vez)
