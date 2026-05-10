import { trpc, type RouterOutputs } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Star,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ClipboardList,
  Receipt,
  CalendarDays,
  Target,
  Gauge,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { motion } from "framer-motion";
import {
  FadeIn,
  StaggerList,
  StaggerItem,
  AnimatedCard,
  AnimatedNumber,
  SkeletonCard,
  SkeletonPulse,
} from "@/components/Animations";
import { useTheme } from "@/contexts/ThemeContext";
import CompanySwitch, { getCompanyInfo } from "@/components/CompanySwitch";
import { Building2 } from "lucide-react";

type WorksSummaryItem =
  RouterOutputs["consultora"]["worksSummary"]["pending"][number];
type RecentSale = RouterOutputs["sales"]["list"][number];

function formatDeadline(deadline: string | Date | null | undefined): string {
  if (!deadline) return "—";
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  return d.toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const RECENT_SALES_INPUT = { limit: 8 } as const;

type FilterPreset =
  | "hoje"
  | "semana"
  | "mes"
  | "mesPassado"
  | "ano"
  | "total"
  | "custom";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthDateFilter() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}

function spanInDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Para cada chave de bucket atual, devolve a chave equivalente no período
// anterior — usado para sobrepor a linha "período anterior" no gráfico.
// Retorna null quando não há equivalente (ex: 31/mai não existe em abril).
function previousKeyFor(
  currentKey: string,
  preset: FilterPreset,
  granularity: "day" | "month"
): string | null {
  if (granularity === "month") {
    // chave YYYY-MM → mesmo mês ano anterior (preset "ano")
    const [y, m] = currentKey.split("-").map(Number);
    if (!y || !m) return null;
    return `${y - 1}-${String(m).padStart(2, "0")}`;
  }
  const [y, m, d] = currentKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  switch (preset) {
    case "hoje":
      date.setDate(date.getDate() - 1);
      return toISODate(date);
    case "semana":
      date.setDate(date.getDate() - 7);
      return toISODate(date);
    case "mes":
    case "mesPassado": {
      // mesmo dia do mês imediatamente anterior; null se não existir
      const prevMonth = m - 2; // m é 1-indexed; -1 vira mês anterior 0-indexed
      const prevYear = prevMonth < 0 ? y - 1 : y;
      const prevMonthAdj = (prevMonth + 12) % 12;
      const lastDay = new Date(prevYear, prevMonthAdj + 1, 0).getDate();
      if (d > lastDay) return null;
      return `${prevYear}-${String(prevMonthAdj + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    case "ano":
      // chega aqui se granularity for "day" e preset "ano" (período < 31 dias,
      // raro). Mesmo dia do ano passado.
      date.setFullYear(date.getFullYear() - 1);
      return toISODate(date);
    default:
      return null;
  }
}

// Calcula, para o preset selecionado, qual é a janela "anterior alinhada" e
// o corte de "atual decorrido" (compareEndDate). Quando o preset é custom ou
// total, retorna nulos e o backend cai no fallback (mesma duração imediatamente
// antes).
function getComparisonRanges(
  preset: FilterPreset,
  dateFilter: { startDate: string; endDate: string }
): {
  compareEndDate?: string;
  previousStartDate?: string;
  previousEndDate?: string;
} {
  if (!dateFilter.startDate || !dateFilter.endDate) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISODate(today);
  const start = new Date(`${dateFilter.startDate}T00:00:00`);
  const end = new Date(`${dateFilter.endDate}T00:00:00`);

  // Quando o período termina no futuro (em andamento), corta em hoje.
  const inProgress = end.getTime() > today.getTime();
  const compareEndDate = inProgress ? todayISO : undefined;
  const effectiveEnd = inProgress ? today : end;

  switch (preset) {
    case "hoje": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        compareEndDate,
        previousStartDate: toISODate(yesterday),
        previousEndDate: toISODate(yesterday),
      };
    }
    case "semana": {
      // Mesma janela seg→dia-equivalente, mas na semana passada
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(effectiveEnd);
      prevEnd.setDate(prevEnd.getDate() - 7);
      return {
        compareEndDate,
        previousStartDate: toISODate(prevStart),
        previousEndDate: toISODate(prevEnd),
      };
    }
    case "mes":
    case "mesPassado": {
      // 1º até "mesmo dia" do mês imediatamente anterior. Se o effectiveEnd
      // é o último dia do seu mês (caso típico de "mesPassado"), compara com
      // o último dia do mês anterior — janelas equivalentes "mês inteiro".
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(
        start.getFullYear(),
        start.getMonth(),
        0
      ).getDate();
      const lastDayCurrentMonth = new Date(
        effectiveEnd.getFullYear(),
        effectiveEnd.getMonth() + 1,
        0
      ).getDate();
      const isLastDay = effectiveEnd.getDate() === lastDayCurrentMonth;
      const targetDay = isLastDay
        ? lastDayPrevMonth
        : Math.min(effectiveEnd.getDate(), lastDayPrevMonth);
      const prevEnd = new Date(
        start.getFullYear(),
        start.getMonth() - 1,
        targetDay
      );
      return {
        compareEndDate,
        previousStartDate: toISODate(prevStart),
        previousEndDate: toISODate(prevEnd),
      };
    }
    case "ano": {
      // 1º jan até hoje, comparado com 1º jan até hoje do ano passado
      const prevStart = new Date(start.getFullYear() - 1, 0, 1);
      const prevEnd = new Date(effectiveEnd);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      return {
        compareEndDate,
        previousStartDate: toISODate(prevStart),
        previousEndDate: toISODate(prevEnd),
      };
    }
    default:
      // total/custom — backend cai no comportamento antigo
      return {};
  }
}

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState(getCurrentMonthDateFilter);
  const [preset, setPreset] = useState<FilterPreset>("mes");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  // Granularidade do gráfico: ≤ 31 dias = barras por dia; senão por mês.
  // Sem datas (preset "total") = mês.
  const span = spanInDays(dateFilter.startDate, dateFilter.endDate);
  const granularity: "day" | "month" =
    span !== null && span <= 31 ? "day" : "month";

  const comparisonRanges = useMemo(
    () => getComparisonRanges(preset, dateFilter),
    [preset, dateFilter.startDate, dateFilter.endDate]
  );

  const periodInput = useMemo(
    () => ({
      startDate: dateFilter.startDate || undefined,
      endDate: dateFilter.endDate || undefined,
      granularity,
      compareEndDate: comparisonRanges.compareEndDate,
      previousStartDate: comparisonRanges.previousStartDate,
      previousEndDate: comparisonRanges.previousEndDate,
    }),
    [
      dateFilter.startDate,
      dateFilter.endDate,
      granularity,
      comparisonRanges.compareEndDate,
      comparisonRanges.previousStartDate,
      comparisonRanges.previousEndDate,
    ]
  );

  const { data: reportData, isLoading } =
    trpc.reports.summary.useQuery(summaryInput);
  const { data: periodData } = trpc.reports.salesByPeriod.useQuery(periodInput);
  const { data: currentMonthMetrics } =
    trpc.reports.currentMonthMetrics.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });
  const { data: recentSales = [] } =
    trpc.sales.list.useQuery(RECENT_SALES_INPUT);

  const chartData = useMemo(() => {
    type Point = {
      name: string;
      total: number;
      vendas: number;
      anterior: number | null;
      fullDate: string;
      isFuture: boolean;
    };
    const buckets = periodData?.buckets ?? [];
    const prevBuckets = periodData?.previousBuckets ?? [];
    const prevMap = new Map(prevBuckets.map(b => [b.key, b]));
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayISO = toISODate(todayDate);

    if (granularity === "month") {
      // Preenche meses faltantes entre primeiro e último bucket (ou janela do filtro).
      let startKey = buckets[0]?.key;
      let endKey = buckets[buckets.length - 1]?.key;
      if (dateFilter.startDate) startKey = dateFilter.startDate.slice(0, 7);
      if (dateFilter.endDate) endKey = dateFilter.endDate.slice(0, 7);
      if (!startKey || !endKey) return [] as Point[];

      const map = new Map(buckets.map(b => [b.key, b]));
      const out: Point[] = [];
      const [sy, sm] = startKey.split("-").map(Number);
      const [ey, em] = endKey.split("-").map(Number);
      let y = sy;
      let m = sm;
      const todayMonthKey = todayISO.slice(0, 7);
      while (y < ey || (y === ey && m <= em)) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        const b = map.get(key);
        const prevKey = previousKeyFor(key, preset, "month");
        const prev = prevKey ? prevMap.get(prevKey) : undefined;
        out.push({
          name: MONTHS_SHORT[m - 1],
          total: b ? b.totalAmount : 0,
          vendas: b ? b.totalSales : 0,
          anterior: prev ? prev.totalAmount : prevKey ? 0 : null,
          fullDate: `${String(m).padStart(2, "0")}/${y}`,
          isFuture: key > todayMonthKey,
        });
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      return out;
    }

    // Granularidade diária — preenche dias faltantes na janela [startDate, endDate].
    if (!dateFilter.startDate || !dateFilter.endDate) return [] as Point[];
    const start = new Date(`${dateFilter.startDate}T00:00:00`);
    const end = new Date(`${dateFilter.endDate}T00:00:00`);
    const useWeekdayLabels = (span ?? 0) <= 7;

    const map = new Map(buckets.map(b => [b.key, b]));
    const out: Point[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const iso = toISODate(cursor);
      const b = map.get(iso);
      const diffDays = Math.round(
        (todayDate.getTime() - cursor.getTime()) / 86_400_000
      );
      let name: string;
      if (useWeekdayLabels) {
        name =
          diffDays === 0
            ? "Hoje"
            : diffDays === 1
              ? "Ontem"
              : WEEKDAYS_SHORT[cursor.getDay()];
      } else {
        name = `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      }
      const prevKey = previousKeyFor(iso, preset, "day");
      const prev = prevKey ? prevMap.get(prevKey) : undefined;
      out.push({
        name,
        total: b ? b.totalAmount : 0,
        vendas: b ? b.totalSales : 0,
        anterior: prev ? prev.totalAmount : prevKey ? 0 : null,
        fullDate: cursor.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        isFuture: iso > todayISO,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [
    periodData,
    granularity,
    dateFilter.startDate,
    dateFilter.endDate,
    span,
    preset,
  ]);

  // Quando o período está em andamento (ex: "Este mês" no dia 10), o backend
  // devolve `current` somando só até hoje — usado para a comparação justa
  // contra o período anterior alinhado.
  const fairCurrentTotal =
    periodData?.current?.totalAmount ??
    chartData.reduce((s, d) => s + d.total, 0);
  const fairCurrentSales =
    periodData?.current?.totalSales ??
    chartData.reduce((s, d) => s + d.vendas, 0);
  const periodTotal = fairCurrentTotal;
  const periodSales = fairCurrentSales;

  const previousTotal = periodData?.previous?.totalAmount ?? null;
  const periodDeltaPct =
    previousTotal !== null && previousTotal > 0
      ? ((periodTotal - previousTotal) / previousTotal) * 100
      : null;

  const chartTitle = useMemo(() => {
    switch (preset) {
      case "hoje":
        return "Hoje";
      case "semana":
        return "Esta Semana";
      case "mes":
        return "Este Mês";
      case "mesPassado":
        return "Mês Passado";
      case "ano":
        return "Este Ano";
      case "total":
        return "Histórico Completo";
      default:
        return "Período Personalizado";
    }
  }, [preset]);

  const comparisonLabel = useMemo(() => {
    switch (preset) {
      case "hoje":
        return "vs. ontem";
      case "semana":
        return "vs. mesma janela da semana passada";
      case "mes":
        return "vs. mesmo período do mês passado";
      case "mesPassado":
        return "vs. mês anterior";
      case "ano":
        return "vs. mesmo período do ano passado";
      case "total":
        return null;
      default:
        return "vs. período anterior de mesma duração";
    }
  }, [preset]);

  const summary = reportData?.summary;
  const topSellers = reportData?.topSellers ?? [];
  const topClients = reportData?.topClients ?? [];
  const summaryByCompany = reportData?.summaryByCompany ?? [];

  const totalAmount = Number(summary?.totalAmount ?? 0);
  const totalSales = Number(summary?.totalSales ?? 0);
  const ticketMedio = totalSales > 0 ? totalAmount / totalSales : 0;
  const dailyAverage = Number(currentMonthMetrics?.dailyAverage ?? 0);
  const lastMonthDailyAverage = Number(
    currentMonthMetrics?.lastMonthDailyAverage ?? 0
  );
  const projectedTotal = Number(currentMonthMetrics?.projectedTotal ?? 0);
  const lastMonthTotal = Number(currentMonthMetrics?.lastMonthTotal ?? 0);
  const dailyAverageDeltaPct =
    lastMonthDailyAverage > 0
      ? ((dailyAverage - lastMonthDailyAverage) / lastMonthDailyAverage) * 100
      : null;
  // Mostra projeção/comparativo de média diária só quando o filtro é o mês
  // atual (faz sentido contextual). Em outros presets, currentMonthMetrics
  // ainda mostra dados do mês corrente, mas escondemos os comparativos para
  // não confundir.
  const showCurrentMonthExtras = preset === "mes";

  const magiaData = summaryByCompany.find(
    (c: { company: string | null }) => c.company === "mundo_da_magia"
  );
  const ciganoData = summaryByCompany.find(
    (c: { company: string | null }) => c.company === "mundo_cigano"
  );
  const magiaInfo = getCompanyInfo("mundo_da_magia");
  const ciganoInfo = getCompanyInfo("mundo_cigano");

  const { data: worksSummary } = trpc.consultora.worksSummary.useQuery(
    undefined,
    { staleTime: 3 * 60 * 1000 }
  );

  const { data: slaData } = trpc.reports.slaMetrics.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: goalsData = [] } =
    trpc.reports.sellerGoalsCurrentMonth.useQuery(undefined, {
      staleTime: 3 * 60 * 1000,
    });
  const pendingWorks: WorksSummaryItem[] = worksSummary?.pending ?? [];
  const toWriteWorks: WorksSummaryItem[] = worksSummary?.toWrite ?? [];

  // Cores do gráfico que funcionam em ambos os temas
  const chartGridColor = "var(--border)";
  const chartTickColor = "var(--muted-foreground)";
  const salesLineColor = isDark
    ? "oklch(0.70 0.16 160)"
    : "oklch(0.55 0.15 160)";
  // Cinza neutro p/ a linha "período anterior" — fica em segundo plano
  const previousLineColor = isDark
    ? "oklch(0.65 0.02 250)"
    : "oklch(0.55 0.02 250)";

  // Mostra a linha de período anterior quando há ao menos 1 ponto com dado
  // anterior conhecido (não-null). Em "total" e "custom" não computamos prev,
  // então `anterior` será null em todos os pontos e a linha some.
  const hasPreviousLine = chartData.some(p => p.anterior !== null);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Company Switch */}
        <CompanySwitch />

        {/* Header */}
        <FadeIn>
          <div className="flex flex-col gap-4">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  color: "var(--foreground)",
                }}
              >
                Dashboard
              </h1>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Visão geral das vendas e performance
              </p>
            </div>
            {/* Filtro de datas */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      key: "hoje",
                      label: "Hoje",
                      fn: () => {
                        const t = isoToday();
                        setDateFilter({ startDate: t, endDate: t });
                      },
                    },
                    {
                      key: "semana",
                      label: "Esta semana",
                      fn: () => {
                        const now = new Date();
                        const day = now.getDay();
                        const mon = new Date(now);
                        mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                        const sun = new Date(mon);
                        sun.setDate(mon.getDate() + 6);
                        setDateFilter({
                          startDate: mon.toISOString().slice(0, 10),
                          endDate: sun.toISOString().slice(0, 10),
                        });
                      },
                    },
                    {
                      key: "mes",
                      label: "Este mês",
                      fn: () => {
                        setDateFilter(getCurrentMonthDateFilter());
                      },
                    },
                    {
                      key: "mesPassado",
                      label: "Mês passado",
                      fn: () => {
                        const now = new Date();
                        const first = new Date(
                          now.getFullYear(),
                          now.getMonth() - 1,
                          1
                        );
                        const last = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          0
                        );
                        setDateFilter({
                          startDate: first.toISOString().slice(0, 10),
                          endDate: last.toISOString().slice(0, 10),
                        });
                      },
                    },
                    {
                      key: "ano",
                      label: "Este ano",
                      fn: () => {
                        const now = new Date();
                        const first = new Date(now.getFullYear(), 0, 1);
                        setDateFilter({
                          startDate: first.toISOString().slice(0, 10),
                          endDate: isoToday(),
                        });
                      },
                    },
                    {
                      key: "total",
                      label: "Total",
                      fn: () => {
                        setDateFilter({ startDate: "", endDate: "" });
                      },
                    },
                  ] as {
                    key: FilterPreset;
                    label: string;
                    fn: () => void;
                  }[]
                ).map(({ key, label, fn }) => {
                  const active = preset === key;
                  return (
                    <motion.button
                      key={label}
                      onClick={() => {
                        fn();
                        setPreset(key);
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: active
                          ? "var(--primary)"
                          : "var(--secondary)",
                        color: active
                          ? "var(--primary-foreground)"
                          : "var(--primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {label}
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={e => {
                    setDateFilter(f => ({ ...f, startDate: e.target.value }));
                    setPreset("custom");
                  }}
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  style={{
                    border: "1.5px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
                <span
                  className="text-sm shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  até
                </span>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={e => {
                    setDateFilter(f => ({ ...f, endDate: e.target.value }));
                    setPreset("custom");
                  }}
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  style={{
                    border: "1.5px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
                {(dateFilter.startDate || dateFilter.endDate) && (
                  <motion.button
                    onClick={() => {
                      setDateFilter({ startDate: "", endDate: "" });
                      setPreset("total");
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium shrink-0"
                    style={{
                      background: "var(--secondary)",
                      color: "var(--primary)",
                    }}
                  >
                    Limpar
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* KPI Cards com Skeleton Loading e Animated Numbers */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <StaggerList className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                {
                  icon: DollarSign,
                  label: "Total Vendido",
                  value: totalAmount,
                  prefix: "R$ ",
                  color: "var(--primary)",
                  bg: "var(--secondary)",
                  // Projeção do mês: só aparece no preset "mes" e quando o
                  // mês ainda não terminou — explicita "para onde vamos" em
                  // vez de mostrar um total parcial sem contexto.
                  subtitle:
                    showCurrentMonthExtras &&
                    projectedTotal > 0 &&
                    (currentMonthMetrics?.daysElapsed ?? 0) <
                      (currentMonthMetrics?.daysInMonth ?? 0)
                      ? `Projetado: ${formatCurrency(projectedTotal)}`
                      : null,
                  subtitleHint: showCurrentMonthExtras
                    ? `Mês passado fechou em ${formatCurrency(lastMonthTotal)}`
                    : null,
                },
                {
                  icon: ShoppingBag,
                  label: "Nº de Vendas",
                  value: totalSales,
                  prefix: "",
                  color: isDark
                    ? "oklch(0.65 0.18 160)"
                    : "oklch(0.55 0.15 160)",
                  bg: isDark ? "var(--secondary)" : "oklch(0.92 0.04 160)",
                  subtitle: null,
                  subtitleHint: null,
                },
                {
                  icon: Receipt,
                  label: "Ticket Médio",
                  value: ticketMedio,
                  prefix: "R$ ",
                  color: isDark
                    ? "oklch(0.68 0.17 300)"
                    : "oklch(0.52 0.18 300)",
                  bg: isDark ? "var(--secondary)" : "oklch(0.94 0.04 300)",
                  subtitle: null,
                  subtitleHint: null,
                },
                {
                  icon: CalendarDays,
                  label: "Média Diária (Mês)",
                  value: dailyAverage,
                  prefix: "R$ ",
                  color: isDark
                    ? "oklch(0.68 0.14 200)"
                    : "oklch(0.52 0.15 200)",
                  bg: isDark ? "var(--secondary)" : "oklch(0.93 0.04 200)",
                  // Comparação 100% justa porque ambos os lados são por dia.
                  delta: showCurrentMonthExtras ? dailyAverageDeltaPct : null,
                  subtitle:
                    showCurrentMonthExtras && lastMonthDailyAverage > 0
                      ? `Mês passado: ${formatCurrency(lastMonthDailyAverage)}/dia`
                      : null,
                  subtitleHint: null,
                },
              ] as Array<{
                icon: typeof DollarSign;
                label: string;
                value: number;
                prefix: string;
                color: string;
                bg: string;
                subtitle: string | null;
                subtitleHint?: string | null;
                delta?: number | null;
              }>
            ).map((card, i) => (
              <StaggerItem key={i}>
                <AnimatedCard
                  className="rounded-2xl p-4 shadow-xl"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <motion.div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: card.bg }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <card.icon
                        className="w-4 h-4 transition-colors duration-200"
                        style={{ color: card.color }}
                      />
                    </motion.div>
                    <span
                      className="text-xs font-medium leading-tight"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {card.label}
                    </span>
                  </div>
                  <p
                    className="text-xl font-bold"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      color: "var(--foreground)",
                    }}
                  >
                    <AnimatedNumber
                      value={card.value}
                      prefix={card.prefix}
                      duration={1}
                    />
                  </p>
                  {card.delta !== null && card.delta !== undefined && (
                    <div
                      className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={{
                        background:
                          card.delta > 0
                            ? isDark
                              ? "oklch(0.28 0.08 160)"
                              : "oklch(0.94 0.06 160)"
                            : card.delta < 0
                              ? isDark
                                ? "oklch(0.30 0.08 25)"
                                : "oklch(0.95 0.05 25)"
                              : "var(--secondary)",
                        color:
                          card.delta > 0
                            ? isDark
                              ? "oklch(0.78 0.18 160)"
                              : "oklch(0.45 0.15 160)"
                            : card.delta < 0
                              ? isDark
                                ? "oklch(0.78 0.18 25)"
                                : "oklch(0.50 0.20 25)"
                              : "var(--muted-foreground)",
                      }}
                      title="Comparação por dia (justa): média diária deste mês vs média diária do mês passado inteiro"
                    >
                      {card.delta > 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : card.delta < 0 ? (
                        <TrendingDown className="w-2.5 h-2.5" />
                      ) : (
                        <Minus className="w-2.5 h-2.5" />
                      )}
                      {card.delta > 0 ? "+" : ""}
                      {card.delta.toFixed(1)}% vs mês passado
                    </div>
                  )}
                  {card.subtitle && (
                    <p
                      className="text-[11px] mt-1 leading-tight"
                      style={{ color: "var(--muted-foreground)" }}
                      title={card.subtitleHint ?? undefined}
                    >
                      {card.subtitle}
                    </p>
                  )}
                </AnimatedCard>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {/* Cards por Empresa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { info: magiaInfo, data: magiaData, key: "mundo_da_magia" },
            { info: ciganoInfo, data: ciganoData, key: "mundo_cigano" },
          ].map(({ info, data, key }) => (
            <FadeIn key={key} delay={0.15}>
              <AnimatedCard
                className="rounded-2xl p-4 shadow-xl border"
                style={{ background: "var(--card)", borderColor: info.border }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: info.bg }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Building2
                      className="w-4 h-4"
                      style={{ color: info.color }}
                    />
                  </motion.div>
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Empresa
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: info.color }}
                    >
                      {info.short}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: info.bg }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Vendido
                    </p>
                    <p
                      className="text-lg font-bold"
                      style={{
                        color: info.color,
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {isLoading ? (
                        <SkeletonPulse width="5em" height="1.4em" />
                      ) : (
                        <AnimatedNumber
                          value={Number(data?.totalAmount ?? 0)}
                          prefix="R$ "
                          duration={1}
                        />
                      )}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: info.bg }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Vendas
                    </p>
                    <p
                      className="text-lg font-bold"
                      style={{
                        color: info.color,
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {isLoading ? (
                        <SkeletonPulse width="3em" height="1.4em" />
                      ) : (
                        <AnimatedNumber
                          value={Number(data?.totalSales ?? 0)}
                          duration={0.8}
                        />
                      )}
                    </p>
                  </div>
                </div>
              </AnimatedCard>
            </FadeIn>
          ))}
        </div>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <FadeIn delay={0.2} className="xl:col-span-2">
            <AnimatedCard
              className="rounded-2xl p-4 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="font-bold flex items-center gap-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    <TrendingUp
                      className="w-4 h-4"
                      style={{ color: "var(--primary)" }}
                    />
                    {chartTitle}
                  </h2>
                  {periodDeltaPct !== null && comparisonLabel && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background:
                          periodDeltaPct > 0
                            ? isDark
                              ? "oklch(0.28 0.08 160)"
                              : "oklch(0.94 0.06 160)"
                            : periodDeltaPct < 0
                              ? isDark
                                ? "oklch(0.30 0.08 25)"
                                : "oklch(0.95 0.05 25)"
                              : "var(--secondary)",
                        color:
                          periodDeltaPct > 0
                            ? isDark
                              ? "oklch(0.78 0.18 160)"
                              : "oklch(0.45 0.15 160)"
                            : periodDeltaPct < 0
                              ? isDark
                                ? "oklch(0.78 0.18 25)"
                                : "oklch(0.50 0.20 25)"
                              : "var(--muted-foreground)",
                      }}
                      title="Faturamento já realizado neste período comparado com o mesmo intervalo do período anterior — comparação justa, sem contar dias futuros."
                    >
                      {periodDeltaPct > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : periodDeltaPct < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Minus className="w-3 h-3" />
                      )}
                      {periodDeltaPct > 0 ? "+" : ""}
                      {periodDeltaPct.toFixed(1)}% {comparisonLabel}
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p
                      className="text-xs font-medium flex items-center gap-1.5 justify-end"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                      Faturamento
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--primary)" }}
                    >
                      <AnimatedNumber
                        value={periodTotal}
                        prefix="R$ "
                        duration={1}
                      />
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-medium flex items-center gap-1.5 justify-end"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: salesLineColor }}
                      />
                      Vendas
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--foreground)" }}
                    >
                      <AnimatedNumber value={periodSales} duration={0.8} />
                    </p>
                  </div>
                  {hasPreviousLine && (
                    <div className="text-right">
                      <p
                        className="text-xs font-medium flex items-center gap-1.5 justify-end"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <span
                          className="inline-block w-2 h-0.5"
                          style={{ background: previousLineColor }}
                        />
                        Período anterior
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: previousLineColor }}
                      >
                        <AnimatedNumber
                          value={previousTotal ?? 0}
                          prefix="R$ "
                          duration={1}
                        />
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartGridColor}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: chartTickColor }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "var(--primary)",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                      opacity: 0.5,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "Faturamento" || name === "Período anterior"
                        ? [formatCurrency(value), name]
                        : [value, name]
                    }
                    labelFormatter={(label: string, payload: any[]) => {
                      const item = payload?.[0]?.payload;
                      return item?.fullDate
                        ? `${label} (${item.fullDate})`
                        : label;
                    }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      background: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="total"
                    name="Faturamento"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#colorTotal)"
                    dot={{
                      r: 4,
                      fill: "var(--primary)",
                      strokeWidth: 2,
                      stroke: "var(--card)",
                    }}
                    activeDot={{
                      r: 7,
                      strokeWidth: 3,
                      stroke: "var(--card)",
                    }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  {hasPreviousLine && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="anterior"
                      name="Período anterior"
                      stroke={previousLineColor}
                      strokeWidth={1.5}
                      strokeDasharray="2 4"
                      strokeOpacity={0.8}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "var(--card)",
                        fill: previousLineColor,
                      }}
                      connectNulls={false}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    />
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="vendas"
                    name="Vendas"
                    stroke={salesLineColor}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{
                      r: 3,
                      fill: salesLineColor,
                      strokeWidth: 2,
                      stroke: "var(--card)",
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 3,
                      stroke: "var(--card)",
                    }}
                    animationDuration={1400}
                    animationEasing="ease-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </AnimatedCard>
          </FadeIn>

          {/* Top Vendedores */}
          <FadeIn delay={0.3}>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <Crown
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                Top Vendedores
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]"
                    />
                  ))}
                </div>
              ) : topSellers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Nenhum vendedor encontrado.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topSellers.map((seller: any, index: number) => (
                    <li
                      key={seller.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--secondary)] text-[var(--primary)]">
                          {index + 1}
                        </span>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {seller.sellerDisplayName ||
                            seller.sellerName ||
                            seller.name}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {formatCurrency(seller.totalAmount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </FadeIn>
        </div>

        {/* Alertas de Trabalhos */}
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StaggerItem>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <AlertTriangle
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                Trabalhos Para Escrever
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]"
                    />
                  ))}
                </div>
              ) : toWriteWorks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Nenhum trabalho para escrever.
                </p>
              ) : (
                <ul className="space-y-3">
                  {toWriteWorks.map(work => (
                    <li
                      key={work.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {work.clientName} - {work.productName}
                        </p>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {work.hasDeadline
                          ? `Prazo: ${formatDeadline(work.deadline)}`
                          : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </StaggerItem>

          <StaggerItem>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <Clock
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                Trabalhos Pendentes
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]"
                    />
                  ))}
                </div>
              ) : pendingWorks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Nenhum trabalho pendente.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pendingWorks.map(work => (
                    <li
                      key={work.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {work.hasDeadline ? (
                          work.isOverdue ? (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          ) : work.isUrgent ? (
                            <Clock className="w-4 h-4 text-orange-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )
                        ) : null}
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {work.clientName} - {work.productName}
                        </p>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {work.hasDeadline
                          ? `Prazo: ${formatDeadline(work.deadline)}`
                          : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </StaggerItem>
        </StaggerList>

        {/* SLA + Metas do Mês */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card SLA */}
          <FadeIn delay={0.35}>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <Gauge
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                SLA de Trabalhos
              </h2>
              {slaData == null ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      className="h-10 rounded-xl animate-pulse bg-[var(--secondary)]"
                    />
                  ))}
                </div>
              ) : slaData.slaRate === null ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Nenhum trabalho concluído ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Taxa */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p
                        className="text-3xl font-bold"
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          color:
                            slaData.slaRate >= 80
                              ? "oklch(0.55 0.18 150)"
                              : slaData.slaRate >= 50
                                ? "oklch(0.60 0.20 60)"
                                : "oklch(0.55 0.22 25)",
                        }}
                      >
                        {slaData.slaRate}%
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        no prazo
                      </p>
                    </div>
                    <div
                      className="text-right text-xs space-y-1"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <p>
                        <span
                          className="font-semibold"
                          style={{ color: "oklch(0.55 0.18 150)" }}
                        >
                          {slaData.completedOnTime}
                        </span>{" "}
                        no prazo
                      </p>
                      <p>
                        <span
                          className="font-semibold"
                          style={{ color: "oklch(0.55 0.22 25)" }}
                        >
                          {slaData.completedLate}
                        </span>{" "}
                        em atraso
                      </p>
                    </div>
                  </div>
                  {/* Barra de progresso */}
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--secondary)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          slaData.slaRate >= 80
                            ? "oklch(0.55 0.18 150)"
                            : slaData.slaRate >= 50
                              ? "oklch(0.60 0.20 60)"
                              : "oklch(0.55 0.22 25)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${slaData.slaRate}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  {/* Em andamento */}
                  <div className="flex gap-3 pt-1">
                    <div
                      className="flex-1 p-3 rounded-xl"
                      style={{ background: "var(--secondary)" }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Em Andamento
                      </p>
                      <p
                        className="text-lg font-bold"
                        style={{
                          color: "var(--foreground)",
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {slaData.inProgressCount}
                      </p>
                    </div>
                    <div
                      className="flex-1 p-3 rounded-xl"
                      style={{
                        background:
                          slaData.overdueCount > 0
                            ? "oklch(0.95 0.04 25)"
                            : "var(--secondary)",
                      }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Em Atraso
                      </p>
                      <p
                        className="text-lg font-bold"
                        style={{
                          color:
                            slaData.overdueCount > 0
                              ? "oklch(0.55 0.22 25)"
                              : "var(--foreground)",
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {slaData.overdueCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </AnimatedCard>
          </FadeIn>

          {/* Card Metas do Mês */}
          <FadeIn delay={0.4}>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <Target
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                Metas do Mês
              </h2>
              {goalsData.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Nenhuma meta configurada. Defina metas na página de
                  Funcionários.
                </p>
              ) : (
                <div className="space-y-4">
                  {goalsData.map(seller => {
                    const pct =
                      seller.monthlyGoal > 0
                        ? Math.min(
                            Math.round(
                              (seller.currentMonthTotal / seller.monthlyGoal) *
                                100
                            ),
                            100
                          )
                        : 0;
                    const barColor =
                      pct >= 100
                        ? "oklch(0.55 0.18 150)"
                        : pct >= 50
                          ? "var(--primary)"
                          : "oklch(0.60 0.20 60)";
                    return (
                      <div key={seller.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p
                            className="text-sm font-medium truncate max-w-[55%]"
                            style={{ color: "var(--foreground)" }}
                          >
                            {seller.name}
                          </p>
                          <p
                            className="text-xs font-semibold shrink-0"
                            style={{ color: barColor }}
                          >
                            {formatCurrency(seller.currentMonthTotal)}
                            <span
                              className="font-normal"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {" "}
                              / {formatCurrency(seller.monthlyGoal)}
                            </span>
                          </p>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--secondary)" }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: barColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                          />
                        </div>
                        <p
                          className="text-[10px] mt-0.5 text-right"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {pct}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </AnimatedCard>
          </FadeIn>
        </div>

        {/* Top Clientes + Vendas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Clientes */}
          <FadeIn delay={0.4}>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ color: "var(--foreground)" }}
              >
                <Star className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Melhores Clientes
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]"
                    />
                  ))}
                </div>
              ) : topClients.length === 0 ? (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Nenhum dado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {topClients.slice(0, 6).map((client: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "var(--secondary)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="text-xs font-bold w-5 text-center"
                          style={{ color: "var(--primary)" }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {client.clientName}
                          </p>
                          {client.clientPhone && (
                            <p
                              className="text-xs"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {client.clientPhone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--primary)" }}
                        >
                          {formatCurrency(client.totalAmount)}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {client.totalSales} venda
                          {Number(client.totalSales) !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AnimatedCard>
          </FadeIn>

          {/* Vendas Recentes */}
          <FadeIn delay={0.5}>
            <AnimatedCard
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Vendas Recentes
              </h2>
              {recentSales.length === 0 ? (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Nenhuma venda ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSales.slice(0, 6).map((item: RecentSale) => {
                    const sale = item.sale ?? item;
                    const seller = item.seller;
                    return (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: "var(--secondary)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {sale.clientName}
                          </p>
                          <p
                            className="text-xs truncate"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {sale.productName} ·{" "}
                            {seller?.displayName || seller?.name || ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "var(--primary)" }}
                          >
                            {formatCurrency(sale.amount)}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {formatDate(sale.saleDate)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AnimatedCard>
          </FadeIn>
        </div>
      </div>
    </DashboardLayout>
  );
}
