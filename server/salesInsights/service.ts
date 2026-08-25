import { z } from "zod";
import {
  SALES_INSIGHTS_TIME_ZONE,
  buildSalesMonthCalendar,
  classifySalesDate,
  getDateOnlyDayCount,
  getDateOnlyRange,
} from "./calendar";
import {
  databaseSalesInsightsRepository,
  type SalesInsightsRepository,
  type SalesInsightsSeller,
} from "./repository";

const MAX_TARGET_AMOUNT = 9_999_999_999.99;
const MAX_PERFORMANCE_RANGE_DAYS = 366;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    try {
      getDateOnlyRange(value, value);
      return true;
    } catch {
      return false;
    }
  }, "Invalid date-only value");

export const salesSnapshotInputSchema = z.object({
  sellerId: z.number().int().positive().optional(),
  targets: z
    .array(z.number().finite().positive().max(MAX_TARGET_AMOUNT))
    .max(10)
    .default([]),
});

export const salesPerformanceInputSchema = z
  .object({
    sellerId: z.number().int().positive().optional(),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
  })
  .superRefine((input, context) => {
    if (input.startDate > input.endDate) {
      context.addIssue({
        code: "custom",
        message: "startDate must not be after endDate",
        path: ["endDate"],
      });
      return;
    }

    if (
      getDateOnlyDayCount(input.startDate, input.endDate) >
      MAX_PERFORMANCE_RANGE_DAYS
    ) {
      context.addIssue({
        code: "custom",
        message: `Date range cannot exceed ${MAX_PERFORMANCE_RANGE_DAYS} days`,
        path: ["endDate"],
      });
    }
  });

export type SalesSnapshotInput = z.input<typeof salesSnapshotInputSchema>;
export type SalesPerformanceInput = z.input<typeof salesPerformanceInputSchema>;
export type SalesInsightsScope = "sales:read:self" | "sales:read:team";

export interface SalesInsightsActor {
  userId: number;
  role: "user" | "admin" | "consultora";
  scopes: readonly SalesInsightsScope[];
}

export class SalesInsightsAuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor() {
    super("Actor is not authorized to access this seller's sales insights");
    this.name = "SalesInsightsAuthorizationError";
  }
}

export class SalesInsightsSellerNotFoundError extends Error {
  readonly code = "SELLER_NOT_FOUND";

  constructor() {
    super("Active seller was not found");
    this.name = "SalesInsightsSellerNotFoundError";
  }
}

function resolveSellerId(
  actor: SalesInsightsActor,
  requestedSellerId?: number
): number {
  const sellerId = requestedSellerId ?? actor.userId;
  const requestingSelf = sellerId === actor.userId;
  const hasSelfScope = actor.scopes.includes("sales:read:self");
  const hasTeamScope = actor.scopes.includes("sales:read:team");

  if (
    requestingSelf &&
    (hasSelfScope || (actor.role === "admin" && hasTeamScope))
  ) {
    return sellerId;
  }

  if (!requestingSelf && actor.role === "admin" && hasTeamScope) {
    return sellerId;
  }

  // A autorização ocorre antes de consultar a existência do vendedor para não
  // transformar IDs válidos/inválidos em um canal lateral de enumeração.
  throw new SalesInsightsAuthorizationError();
}

function requireSafeInteger(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Monetary calculation exceeded safe integer range");
  }
  return value;
}

function parseMoneyToCents(value: string | number): number {
  const normalized =
    typeof value === "number"
      ? value.toFixed(2)
      : value.trim().replace(/^\+/, "");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new RangeError(`Invalid monetary value: ${value}`);

  const cents =
    Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return requireSafeInteger(match[1] === "-" ? -cents : cents);
}

function formatCents(value: number): string {
  requireSafeInteger(value);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function maxZero(value: number): number {
  return value > 0 ? value : 0;
}

function divideRounded(value: number, divisor: number): number {
  if (divisor <= 0) throw new RangeError("divisor must be positive");
  const sign = value < 0 ? -1 : 1;
  return requireSafeInteger(sign * Math.round(Math.abs(value) / divisor));
}

function divideCeilNonNegative(value: number, divisor: number): number {
  if (value < 0 || divisor <= 0) {
    throw new RangeError("Expected a non-negative value and positive divisor");
  }
  return requireSafeInteger(Math.ceil(value / divisor));
}

function getSellerLabel(seller: SalesInsightsSeller): string {
  return seller.displayName || seller.name || `Vendedor ${seller.id}`;
}

function buildGoalScenario(
  source: "official" | "simulation",
  targetCents: number,
  monthCents: number,
  todayCents: number,
  calendar: ReturnType<typeof buildSalesMonthCalendar>
) {
  const beforeTodayCents = monthCents - todayCents;
  const remainingCents = maxZero(targetCents - monthCents);
  const requiredPerPrimaryDayCents =
    calendar.remainingPrimaryWeekdays > 0
      ? divideCeilNonNegative(remainingCents, calendar.remainingPrimaryWeekdays)
      : null;
  const isIncompleteWeekday =
    calendar.currentDay.period === "weekday_full" &&
    calendar.currentDay.status === "in_progress";
  const plannedTodayCents = isIncompleteWeekday
    ? divideCeilNonNegative(
        maxZero(targetCents - beforeTodayCents),
        calendar.remainingPrimaryWeekdays
      )
    : null;
  const remainingTodayCents =
    plannedTodayCents === null ? null : maxZero(plannedTodayCents - todayCents);
  const plannedBeforeTodayCents = divideRounded(
    requireSafeInteger(
      targetCents * calendar.completedPrimaryWeekdaysBeforeToday
    ),
    calendar.totalPrimaryWeekdays
  );
  const paceActualCents = isIncompleteWeekday ? beforeTodayCents : monthCents;
  const paceDifferenceCents = paceActualCents - plannedBeforeTodayCents;

  return {
    source,
    targetAmount: formatCents(targetCents),
    remainingAmount: formatCents(remainingCents),
    remainingPrimaryWeekdays: calendar.remainingPrimaryWeekdays,
    requiredPerPrimaryWeekdayFromNow:
      requiredPerPrimaryDayCents === null
        ? null
        : formatCents(requiredPerPrimaryDayCents),
    unallocatedAfterPrimaryWeekdays:
      calendar.remainingPrimaryWeekdays === 0
        ? formatCents(remainingCents)
        : "0.00",
    today:
      plannedTodayCents === null
        ? null
        : {
            status: "in_progress" as const,
            plannedAmountAtStartOfDay: formatCents(plannedTodayCents),
            soldAmount: formatCents(todayCents),
            remainingAmount: formatCents(remainingTodayCents ?? 0),
          },
    pace: {
      basis: isIncompleteWeekday
        ? ("through_previous_completed_weekday" as const)
        : ("through_current_closed_period" as const),
      plannedAmount: formatCents(plannedBeforeTodayCents),
      actualAmount: formatCents(paceActualCents),
      differenceAmount: formatCents(paceDifferenceCents),
      status:
        paceDifferenceCents > 0
          ? ("ahead" as const)
          : paceDifferenceCents < 0
            ? ("behind" as const)
            : ("on_target" as const),
    },
  };
}

function buildProjection(
  monthCents: number,
  completedCents: number,
  calendar: ReturnType<typeof buildSalesMonthCalendar>
) {
  const completedHalfUnits = Math.round(calendar.completedCapacityUnits * 2);
  const futureHalfUnits = Math.round(
    calendar.futureCapacityUnitsAfterToday * 2
  );

  if (completedHalfUnits === 0) {
    return {
      projectedMonthAmount: null,
      completedAveragePerWorkPeriod: null,
      completedAveragePerFullDayEquivalent: null,
      completedWorkPeriods: calendar.completedWorkPeriods,
      completedCapacityUnits: calendar.completedCapacityUnits,
      currentDayExtrapolated: false,
      method: "insufficient_completed_periods" as const,
    };
  }

  const projectedFutureCents = divideRounded(
    requireSafeInteger(completedCents * futureHalfUnits),
    completedHalfUnits
  );

  return {
    projectedMonthAmount: formatCents(monthCents + projectedFutureCents),
    completedAveragePerWorkPeriod: formatCents(
      divideRounded(completedCents, calendar.completedWorkPeriods)
    ),
    completedAveragePerFullDayEquivalent: formatCents(
      divideRounded(requireSafeInteger(completedCents * 2), completedHalfUnits)
    ),
    completedWorkPeriods: calendar.completedWorkPeriods,
    completedCapacityUnits: calendar.completedCapacityUnits,
    currentDayExtrapolated: false,
    method: "completed_work_capacity_average" as const,
  };
}

export function createSalesInsightsService(
  repository: SalesInsightsRepository = databaseSalesInsightsRepository
) {
  return {
    async getSalesSnapshot(
      actor: SalesInsightsActor,
      rawInput: SalesSnapshotInput,
      now: Date = new Date()
    ) {
      const input = salesSnapshotInputSchema.parse(rawInput);
      const sellerId = resolveSellerId(actor, input.sellerId);
      const calendar = buildSalesMonthCalendar(now);
      const [seller, aggregates] = await Promise.all([
        repository.getSeller(sellerId),
        repository.getSnapshotAggregates({
          sellerId,
          monthStart: calendar.monthStart,
          today: calendar.localDate,
          completedThroughDate: calendar.completedThroughDate,
        }),
      ]);

      if (!seller) throw new SalesInsightsSellerNotFoundError();

      const monthCents = parseMoneyToCents(aggregates.month.totalAmount);
      const todayCents = parseMoneyToCents(aggregates.today.totalAmount);
      const completedCents = parseMoneyToCents(
        aggregates.completed.totalAmount
      );
      const officialTargetCents = seller.monthlyGoal
        ? parseMoneyToCents(seller.monthlyGoal)
        : null;
      const simulationTargets = Array.from(
        new Set(
          input.targets.map(target => formatCents(parseMoneyToCents(target)))
        )
      )
        .map(parseMoneyToCents)
        .filter(target => target !== officialTargetCents);

      return {
        dataClassification: "aggregated_sales_only" as const,
        asOf: {
          instant: now.toISOString(),
          timeZone: SALES_INSIGHTS_TIME_ZONE,
          localDate: calendar.localDate,
          localTime: calendar.localTime,
          dayStatus: calendar.currentDay.status,
          workPeriod: calendar.currentDay.period,
        },
        seller: {
          id: seller.id,
          name: getSellerLabel(seller),
        },
        totals: {
          todayAmount: formatCents(todayCents),
          todaySales: aggregates.today.totalSales,
          monthAmount: formatCents(monthCents),
          monthSales: aggregates.month.totalSales,
        },
        calendar: {
          monthStart: calendar.monthStart,
          monthEnd: calendar.monthEnd,
          totalPrimaryWeekdays: calendar.totalPrimaryWeekdays,
          completedPrimaryWeekdaysBeforeToday:
            calendar.completedPrimaryWeekdaysBeforeToday,
          remainingPrimaryWeekdays: calendar.remainingPrimaryWeekdays,
          primaryWeekdaysAfterToday: calendar.primaryWeekdaysAfterToday,
          futureSaturdaysAreSupplemental: true,
          saturdayClosesAt: "12:00",
        },
        officialTarget:
          officialTargetCents === null
            ? null
            : buildGoalScenario(
                "official",
                officialTargetCents,
                monthCents,
                todayCents,
                calendar
              ),
        simulations: simulationTargets.map(target =>
          buildGoalScenario(
            "simulation",
            target,
            monthCents,
            todayCents,
            calendar
          )
        ),
        projection: buildProjection(monthCents, completedCents, calendar),
        limitations: [
          "weekday_hours_not_configured",
          "current_incomplete_day_not_extrapolated",
          "calendar_uses_weekdays_without_holiday_exclusions",
        ] as const,
      };
    },

    async getSalesPerformance(
      actor: SalesInsightsActor,
      rawInput: SalesPerformanceInput,
      now: Date = new Date()
    ) {
      const input = salesPerformanceInputSchema.parse(rawInput);
      const sellerId = resolveSellerId(actor, input.sellerId);
      const [seller, aggregateRows] = await Promise.all([
        repository.getSeller(sellerId),
        repository.getDailyAggregates({
          sellerId,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ]);

      if (!seller) throw new SalesInsightsSellerNotFoundError();

      const rowByDate = new Map(aggregateRows.map(row => [row.date, row]));
      const series = getDateOnlyRange(input.startDate, input.endDate).map(
        date => {
          const row = rowByDate.get(date);
          const classification = classifySalesDate(date, now);
          return {
            date,
            amount: formatCents(parseMoneyToCents(row?.totalAmount ?? "0.00")),
            sales: row?.totalSales ?? 0,
            status: classification.status,
            workPeriod: classification.period,
            capacityUnits: classification.capacityUnits,
          };
        }
      );
      const totalCents = series.reduce(
        (total, day) => total + parseMoneyToCents(day.amount),
        0
      );
      const completedSeries = series.filter(day => day.status === "completed");
      const completedCents = completedSeries.reduce(
        (total, day) => total + parseMoneyToCents(day.amount),
        0
      );
      const completedHalfUnits = Math.round(
        completedSeries.reduce((total, day) => total + day.capacityUnits, 0) * 2
      );
      const bestDay = completedSeries.reduce<
        (typeof completedSeries)[number] | null
      >(
        (best, day) =>
          !best ||
          parseMoneyToCents(day.amount) > parseMoneyToCents(best.amount)
            ? day
            : best,
        null
      );
      const worstDay = completedSeries.reduce<
        (typeof completedSeries)[number] | null
      >(
        (worst, day) =>
          !worst ||
          parseMoneyToCents(day.amount) < parseMoneyToCents(worst.amount)
            ? day
            : worst,
        null
      );

      return {
        dataClassification: "aggregated_sales_only" as const,
        asOf: {
          instant: now.toISOString(),
          timeZone: SALES_INSIGHTS_TIME_ZONE,
        },
        seller: {
          id: seller.id,
          name: getSellerLabel(seller),
        },
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
          totalAmount: formatCents(totalCents),
          totalSales: series.reduce((total, day) => total + day.sales, 0),
        },
        completedPerformance: {
          workPeriods: completedSeries.length,
          capacityUnits: completedHalfUnits / 2,
          averagePerWorkPeriod:
            completedSeries.length === 0
              ? null
              : formatCents(
                  divideRounded(completedCents, completedSeries.length)
                ),
          averagePerFullDayEquivalent:
            completedHalfUnits === 0
              ? null
              : formatCents(
                  divideRounded(
                    requireSafeInteger(completedCents * 2),
                    completedHalfUnits
                  )
                ),
          bestDay,
          worstDay,
        },
        series,
        limitations: [
          "weekday_hours_not_configured",
          "current_incomplete_day_excluded_from_completed_averages",
          "calendar_uses_weekdays_without_holiday_exclusions",
        ] as const,
      };
    },
  };
}

export const salesInsightsService = createSalesInsightsService();
