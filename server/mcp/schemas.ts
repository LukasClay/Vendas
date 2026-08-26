import { z } from "zod";
import {
  salesPerformanceInputSchema,
  salesSnapshotInputSchema,
} from "../salesInsights/service";

const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dayStatusSchema = z.enum([
  "completed",
  "in_progress",
  "closed",
  "future",
]);
const workPeriodSchema = z.enum([
  "weekday_full",
  "saturday_half",
  "sunday_closed",
]);

const goalScenarioSchema = z
  .object({
    source: z.enum(["official", "simulation"]),
    targetAmount: moneySchema,
    remainingAmount: moneySchema,
    remainingPrimaryWeekdays: z.number().int().nonnegative(),
    requiredPerPrimaryWeekdayFromNow: moneySchema.nullable(),
    unallocatedAfterPrimaryWeekdays: moneySchema,
    today: z
      .object({
        status: z.literal("in_progress"),
        plannedAmountAtStartOfDay: moneySchema,
        soldAmount: moneySchema,
        remainingAmount: moneySchema,
      })
      .strict()
      .nullable(),
    pace: z
      .object({
        basis: z.enum([
          "through_previous_completed_weekday",
          "through_current_closed_period",
        ]),
        plannedAmount: moneySchema,
        actualAmount: moneySchema,
        differenceAmount: moneySchema,
        status: z.enum(["ahead", "behind", "on_target"]),
      })
      .strict(),
  })
  .strict();

export const salesSnapshotToolInputSchema = salesSnapshotInputSchema
  .omit({ sellerId: true })
  .strict();

export const salesSnapshotOutputSchema = z
  .object({
    dataClassification: z.literal("aggregated_sales_only"),
    asOf: z
      .object({
        instant: z.string(),
        timeZone: z.literal("America/Sao_Paulo"),
        localDate: dateOnlySchema,
        localTime: z.string().regex(/^\d{2}:\d{2}$/),
        dayStatus: dayStatusSchema,
        workPeriod: workPeriodSchema,
      })
      .strict(),
    seller: z
      .object({
        id: z.number().int().positive(),
        name: z.string(),
      })
      .strict(),
    totals: z
      .object({
        todayAmount: moneySchema,
        todaySales: z.number().int().nonnegative(),
        monthAmount: moneySchema,
        monthSales: z.number().int().nonnegative(),
      })
      .strict(),
    calendar: z
      .object({
        monthStart: dateOnlySchema,
        monthEnd: dateOnlySchema,
        totalPrimaryWeekdays: z.number().int().positive(),
        completedPrimaryWeekdaysBeforeToday: z.number().int().nonnegative(),
        remainingPrimaryWeekdays: z.number().int().nonnegative(),
        primaryWeekdaysAfterToday: z.number().int().nonnegative(),
        futureSaturdaysAreSupplemental: z.literal(true),
        saturdayClosesAt: z.literal("12:00"),
      })
      .strict(),
    officialTarget: goalScenarioSchema.nullable(),
    simulations: z.array(goalScenarioSchema),
    projection: z
      .object({
        projectedMonthAmount: moneySchema.nullable(),
        completedAveragePerWorkPeriod: moneySchema.nullable(),
        completedAveragePerFullDayEquivalent: moneySchema.nullable(),
        completedWorkPeriods: z.number().int().nonnegative(),
        completedCapacityUnits: z.number().nonnegative(),
        currentDayExtrapolated: z.literal(false),
        method: z.enum([
          "insufficient_completed_periods",
          "completed_work_capacity_average",
        ]),
      })
      .strict(),
    limitations: z.array(z.string()),
  })
  .strict();

export const salesPerformanceToolInputSchema = salesPerformanceInputSchema
  .omit({ sellerId: true })
  .strict();

const performanceDaySchema = z
  .object({
    date: dateOnlySchema,
    amount: moneySchema,
    sales: z.number().int().nonnegative(),
    status: dayStatusSchema,
    workPeriod: workPeriodSchema,
    capacityUnits: z.number().min(0).max(1),
  })
  .strict();

export const salesPerformanceOutputSchema = z
  .object({
    dataClassification: z.literal("aggregated_sales_only"),
    asOf: z
      .object({
        instant: z.string(),
        timeZone: z.literal("America/Sao_Paulo"),
      })
      .strict(),
    seller: z
      .object({
        id: z.number().int().positive(),
        name: z.string(),
      })
      .strict(),
    period: z
      .object({
        startDate: dateOnlySchema,
        endDate: dateOnlySchema,
        totalAmount: moneySchema,
        totalSales: z.number().int().nonnegative(),
      })
      .strict(),
    completedPerformance: z
      .object({
        workPeriods: z.number().int().nonnegative(),
        capacityUnits: z.number().nonnegative(),
        averagePerWorkPeriod: moneySchema.nullable(),
        averagePerFullDayEquivalent: moneySchema.nullable(),
        bestDay: performanceDaySchema.nullable(),
        worstDay: performanceDaySchema.nullable(),
      })
      .strict(),
    series: z.array(performanceDaySchema),
    limitations: z.array(z.string()),
  })
  .strict();
