import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sales, users } from "../../drizzle/schema";
import { getDb } from "../db";

export interface SalesInsightsSeller {
  id: number;
  name: string | null;
  displayName: string | null;
  role: "user" | "admin" | "consultora";
  monthlyGoal: string | null;
}

export interface SalesAggregate {
  totalAmount: string;
  totalSales: number;
}

export interface SalesSnapshotAggregates {
  month: SalesAggregate;
  today: SalesAggregate;
  completed: SalesAggregate;
}

export interface DailySalesAggregate extends SalesAggregate {
  date: string;
}

export interface SalesSnapshotAggregateInput {
  sellerId: number;
  monthStart: string;
  today: string;
  completedThroughDate: string | null;
}

export interface SalesPerformanceAggregateInput {
  sellerId: number;
  startDate: string;
  endDate: string;
}

export interface SalesInsightsRepository {
  getSeller(sellerId: number): Promise<SalesInsightsSeller | null>;
  getSnapshotAggregates(
    input: SalesSnapshotAggregateInput
  ): Promise<SalesSnapshotAggregates>;
  getDailyAggregates(
    input: SalesPerformanceAggregateInput
  ): Promise<DailySalesAggregate[]>;
}

export class SalesInsightsDataSourceUnavailableError extends Error {
  readonly code = "DATA_SOURCE_UNAVAILABLE";

  constructor() {
    super("Sales Insights data source is unavailable");
    this.name = "SalesInsightsDataSourceUnavailableError";
  }
}

export type SalesInsightsDatabase<TSchema extends Record<string, unknown>> =
  NodePgDatabase<TSchema>;

export function buildSalesInsightsSellerQuery<
  TSchema extends Record<string, unknown>,
>(db: SalesInsightsDatabase<TSchema>, sellerId: number) {
  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      role: users.role,
      monthlyGoal: users.monthlyGoal,
    })
    .from(users)
    .where(
      and(
        eq(users.id, sellerId),
        eq(users.active, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);
}

export function buildSalesSnapshotAggregateQuery<
  TSchema extends Record<string, unknown>,
>(db: SalesInsightsDatabase<TSchema>, input: SalesSnapshotAggregateInput) {
  const completedAmount = input.completedThroughDate
    ? sql<string>`coalesce(sum(${sales.amount}) filter (where ${sales.saleDate} <= ${input.completedThroughDate}), 0)::text`
    : sql<string>`'0.00'`;
  const completedCount = input.completedThroughDate
    ? sql<number>`(count(*) filter (where ${sales.saleDate} <= ${input.completedThroughDate}))::int`
    : sql<number>`0`;

  return db
    .select({
      monthAmount: sql<string>`coalesce(sum(${sales.amount}), 0)::text`,
      monthCount: sql<number>`count(*)::int`,
      todayAmount: sql<string>`coalesce(sum(${sales.amount}) filter (where ${sales.saleDate} = ${input.today}), 0)::text`,
      todayCount: sql<number>`(count(*) filter (where ${sales.saleDate} = ${input.today}))::int`,
      completedAmount,
      completedCount,
    })
    .from(sales)
    .where(
      and(
        eq(sales.sellerId, input.sellerId),
        gte(sales.saleDate, input.monthStart),
        lte(sales.saleDate, input.today),
        isNull(sales.deletedAt)
      )
    );
}

export function buildDailySalesAggregateQuery<
  TSchema extends Record<string, unknown>,
>(db: SalesInsightsDatabase<TSchema>, input: SalesPerformanceAggregateInput) {
  return db
    .select({
      date: sales.saleDate,
      totalAmount: sql<string>`coalesce(sum(${sales.amount}), 0)::text`,
      totalSales: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.sellerId, input.sellerId),
        gte(sales.saleDate, input.startDate),
        lte(sales.saleDate, input.endDate),
        isNull(sales.deletedAt)
      )
    )
    .groupBy(sales.saleDate)
    .orderBy(asc(sales.saleDate));
}

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new SalesInsightsDataSourceUnavailableError();
  return db;
}

export const databaseSalesInsightsRepository: SalesInsightsRepository = {
  async getSeller(sellerId) {
    const db = await requireDatabase();
    const [seller] = await buildSalesInsightsSellerQuery(db, sellerId);
    return seller ?? null;
  },

  async getSnapshotAggregates(input) {
    const db = await requireDatabase();
    const [row] = await buildSalesSnapshotAggregateQuery(db, input);

    return {
      month: {
        totalAmount: row?.monthAmount ?? "0.00",
        totalSales: row?.monthCount ?? 0,
      },
      today: {
        totalAmount: row?.todayAmount ?? "0.00",
        totalSales: row?.todayCount ?? 0,
      },
      completed: {
        totalAmount: row?.completedAmount ?? "0.00",
        totalSales: row?.completedCount ?? 0,
      },
    };
  },

  async getDailyAggregates(input) {
    const db = await requireDatabase();
    return await buildDailySalesAggregateQuery(db, input);
  },
};
