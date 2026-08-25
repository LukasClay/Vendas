import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  buildDailySalesAggregateQuery,
  buildSalesInsightsSellerQuery,
  buildSalesSnapshotAggregateQuery,
} from "./repository";

const db = drizzle.mock();

function compactSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("Sales Insights aggregate queries", () => {
  it("selects only the seller profile fields required by the contract", () => {
    const query = buildSalesInsightsSellerQuery(db, 42).toSQL();
    const statement = compactSql(query.sql);

    expect(statement).toContain('from "users"');
    expect(statement).toContain('"users"."active" = $2');
    expect(statement).toContain('"users"."deletedAt" is null');
    expect(statement).not.toContain('"passwordHash"');
    expect(statement).not.toContain('"sessionVersion"');
    expect(statement).not.toContain('"email"');
    expect(query.params).toContain(42);
  });

  it("scopes snapshot aggregates to one seller and excludes soft-deleted sales", () => {
    const query = buildSalesSnapshotAggregateQuery(db, {
      sellerId: 42,
      monthStart: "2026-08-01",
      today: "2026-08-25",
      completedThroughDate: "2026-08-24",
    }).toSQL();
    const statement = compactSql(query.sql);

    expect(statement).toContain('from "sales"');
    expect(statement).toContain('"sales"."sellerId" =');
    expect(statement).toContain('"sales"."deletedAt" is null');
    expect(query.params).toContain(42);
    expect(statement).not.toContain('"clientName"');
    expect(statement).not.toContain('"clientPhone"');
    expect(statement).not.toContain('"notes"');
    expect(statement).not.toContain('"attachmentKey"');
    expect(statement).not.toContain('"photo1Key"');
  });

  it("returns only date, amount and count in performance buckets", () => {
    const query = buildDailySalesAggregateQuery(db, {
      sellerId: 7,
      startDate: "2026-08-01",
      endDate: "2026-08-25",
    }).toSQL();
    const statement = compactSql(query.sql);

    expect(statement).toContain('group by "sales"."saleDate"');
    expect(statement).toContain('"sales"."sellerId" =');
    expect(statement).toContain('"sales"."deletedAt" is null');
    expect(statement).not.toContain('"clientName"');
    expect(statement).not.toContain('"productName"');
  });
});
