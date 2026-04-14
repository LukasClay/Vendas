/**
 * Utilitário de dias úteis com feriados brasileiros e internacionais
 * reconhecidos no Brasil (fixos + móveis baseados na Páscoa).
 */

/** Calcula a Páscoa pelo algoritmo de Butcher/Anonymous Gregorian */
function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Retorna o conjunto de feriados do ano no formato "YYYY-MM-DD" */
function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>();

  // ── Feriados fixos nacionais brasileiros ──────────────────────────────────
  const fixed = [
    "01-01", // Confraternização Universal (Ano Novo)
    "04-21", // Tiradentes
    "05-01", // Dia do Trabalho
    "09-07", // Independência do Brasil
    "10-12", // Nossa Senhora Aparecida
    "11-02", // Finados
    "11-15", // Proclamação da República
    "11-20", // Dia da Consciência Negra (lei federal desde 2023)
    "12-25", // Natal
  ];
  fixed.forEach(d => holidays.add(`${year}-${d}`));

  // ── Feriados móveis baseados na Páscoa ────────────────────────────────────
  const easter = easterDate(year);

  const addOffset = (base: Date, offsetDays: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offsetDays);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    holidays.add(`${d.getFullYear()}-${mm}-${dd}`);
  };

  addOffset(easter, -48); // Segunda-feira de Carnaval
  addOffset(easter, -47); // Terça-feira de Carnaval
  addOffset(easter, -2); // Sexta-feira Santa (Paixão de Cristo) — feriado nacional
  addOffset(easter, 0); // Páscoa (Domingo — não útil de qualquer forma)
  addOffset(easter, 60); // Corpus Christi

  return holidays;
}

/** Verifica se uma data é feriado */
function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return getHolidaysForYear(year).has(`${year}-${mm}-${dd}`);
}

/** Verifica se uma data é dia útil (seg-sex e não feriado) */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // domingo ou sábado
  return !isHoliday(date);
}

/**
 * Calcula a data limite: a partir do dia seguinte à venda,
 * conta N dias úteis (pulando sábado, domingo e feriados).
 * Algoritmo: avança o cursor e conta apenas dias úteis.
 */
export function calcDeadline(saleDateStr: string, businessDays = 7): Date {
  const saleDate = new Date(saleDateStr + "T00:00:00");
  const cursor = new Date(saleDate);
  cursor.setDate(cursor.getDate() + 1); // começa no dia seguinte à venda
  let count = 0;
  while (count < businessDays) {
    if (isBusinessDay(cursor)) {
      count++;
      if (count === businessDays) break; // parar exatamente no N-ésimo dia útil
    }
    if (count < businessDays) cursor.setDate(cursor.getDate() + 1);
  }
  return new Date(cursor);
}

/**
 * Calcula dias úteis restantes de hoje até o deadline (inclusive).
 * Se já passou do deadline, retorna negativo (dias de atraso).
 */
export function calcBusinessDaysFromSale(
  saleDateStr: string,
  businessDays = 7
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = calcDeadline(saleDateStr, businessDays);
  deadline.setHours(0, 0, 0, 0);

  let daysRemaining = 0;

  if (today <= deadline) {
    // Conta dias úteis de amanhã até o deadline (inclusive)
    // O dia de hoje não conta — o prazo é calculado a partir do dia seguinte à venda
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1); // começa amanhã
    while (cursor <= deadline) {
      if (isBusinessDay(cursor)) daysRemaining++;
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    // Atrasado: conta dias úteis após o deadline até ontem
    const cursor = new Date(deadline);
    cursor.setDate(cursor.getDate() + 1);
    let overdueDays = 0;
    while (cursor <= today) {
      if (isBusinessDay(cursor)) overdueDays++;
      cursor.setDate(cursor.getDate() + 1);
    }
    daysRemaining = -overdueDays;
  }

  const isOverdue = daysRemaining < 0;
  const isUrgent = daysRemaining <= 1 && daysRemaining >= 0;
  const urgencyScore = isOverdue
    ? 10000 + Math.abs(daysRemaining)
    : businessDays - daysRemaining;

  return { daysRemaining, deadline, isOverdue, isUrgent, urgencyScore };
}

/**
 * Categorias de produtos sem prazo automático.
 * Trabalhos `coletivo` são executados em datas específicas (marcadas no mês),
 * por isso não recebem o prazo global de dias úteis a partir da venda.
 */
const CATEGORIES_WITHOUT_DEADLINE = new Set(["coletivo"]);

/**
 * Retorna true quando a categoria segue a regra de prazo automático
 * (7 dias úteis a partir do dia seguinte à venda).
 */
export function hasAutomaticDeadline(
  productCategory: string | null | undefined
): boolean {
  if (!productCategory) return true;
  return !CATEGORIES_WITHOUT_DEADLINE.has(productCategory);
}

export type SaleUrgency = {
  /** `true` quando a categoria aplica o prazo automático. */
  hasDeadline: boolean;
  /** Dias úteis restantes (negativo = atrasado). `0` quando `hasDeadline = false`. */
  daysRemaining: number;
  /** Data limite calculada. `null` quando `hasDeadline = false`. */
  deadline: Date | null;
  isOverdue: boolean;
  isUrgent: boolean;
  /**
   * Score para ordenação. Itens sem prazo automático recebem
   * `Number.NEGATIVE_INFINITY`, ficando no final da ordenação por urgência
   * sem gerar falsa prioridade.
   */
  urgencyScore: number;
};

/**
 * Calcula a urgência respeitando a categoria do produto.
 * Centraliza a regra para evitar condicionais espalhadas nos consumidores.
 */
export function getSaleUrgency(
  saleDateStr: string,
  productCategory: string | null | undefined,
  businessDays = 7
): SaleUrgency {
  if (!hasAutomaticDeadline(productCategory)) {
    return {
      hasDeadline: false,
      daysRemaining: 0,
      deadline: null,
      isOverdue: false,
      isUrgent: false,
      urgencyScore: Number.NEGATIVE_INFINITY,
    };
  }
  const urgency = calcBusinessDaysFromSale(saleDateStr, businessDays);
  return { hasDeadline: true, ...urgency };
}
