import { describe, expect, it, vi } from "vitest";
import type { SalesInsightsRepository } from "./repository";
import {
  SalesInsightsAuthorizationError,
  createSalesInsightsService,
  type SalesInsightsActor,
} from "./service";

const selfActor: SalesInsightsActor = {
  userId: 7,
  role: "user",
  scopes: ["sales:read:self"],
};

function createRepository(
  overrides: Partial<SalesInsightsRepository> = {}
): SalesInsightsRepository {
  return {
    getSeller: vi.fn(async sellerId => ({
      id: sellerId,
      name: "Vendedor de teste",
      displayName: null,
      role: "user",
      monthlyGoal: "20000.00",
    })),
    getSnapshotAggregates: vi.fn(async () => ({
      month: { totalAmount: "10500.00", totalSales: 12 },
      today: { totalAmount: "500.00", totalSales: 1 },
      completed: { totalAmount: "10000.00", totalSales: 11 },
    })),
    getDailyAggregates: vi.fn(async () => []),
    ...overrides,
  };
}

describe("Sales Insights authorization", () => {
  it("rejects a seller requesting another seller before touching the repository", async () => {
    const repository = createRepository();
    const service = createSalesInsightsService(repository);

    await expect(
      service.getSalesSnapshot(
        selfActor,
        { sellerId: 8 },
        new Date("2026-08-25T13:00:00.000Z")
      )
    ).rejects.toBeInstanceOf(SalesInsightsAuthorizationError);
    expect(repository.getSeller).not.toHaveBeenCalled();
    expect(repository.getSnapshotAggregates).not.toHaveBeenCalled();
  });

  it("does not let an admin read team data without the team scope", async () => {
    const repository = createRepository();
    const service = createSalesInsightsService(repository);

    await expect(
      service.getSalesPerformance(
        { userId: 1, role: "admin", scopes: ["sales:read:self"] },
        {
          sellerId: 8,
          startDate: "2026-08-01",
          endDate: "2026-08-25",
        }
      )
    ).rejects.toBeInstanceOf(SalesInsightsAuthorizationError);
    expect(repository.getSeller).not.toHaveBeenCalled();
    expect(repository.getDailyAggregates).not.toHaveBeenCalled();
  });

  it("allows an admin with team scope to select another seller", async () => {
    const repository = createRepository();
    const service = createSalesInsightsService(repository);

    const result = await service.getSalesSnapshot(
      { userId: 1, role: "admin", scopes: ["sales:read:team"] },
      { sellerId: 8 },
      new Date("2026-08-25T13:00:00.000Z")
    );

    expect(result.seller.id).toBe(8);
    expect(repository.getSeller).toHaveBeenCalledWith(8);
    expect(repository.getSnapshotAggregates).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 8 })
    );
  });
});

describe("getSalesSnapshot", () => {
  it("calculates official and conversational targets without persisting simulations", async () => {
    const repository = createRepository();
    const service = createSalesInsightsService(repository);

    const result = await service.getSalesSnapshot(
      selfActor,
      { targets: [22_500, 22_500] },
      new Date("2026-08-25T13:00:00.000Z")
    );

    expect(result.asOf).toMatchObject({
      localDate: "2026-08-25",
      dayStatus: "in_progress",
      workPeriod: "weekday_full",
    });
    expect(result.officialTarget).toMatchObject({
      source: "official",
      targetAmount: "20000.00",
      remainingAmount: "9500.00",
      remainingPrimaryWeekdays: 5,
      requiredPerPrimaryWeekdayFromNow: "1900.00",
      today: {
        status: "in_progress",
        plannedAmountAtStartOfDay: "2000.00",
        soldAmount: "500.00",
        remainingAmount: "1500.00",
      },
    });
    expect(result.simulations).toHaveLength(1);
    expect(result.simulations[0]).toMatchObject({
      source: "simulation",
      targetAmount: "22500.00",
      remainingAmount: "12000.00",
      requiredPerPrimaryWeekdayFromNow: "2400.00",
    });
    expect(result.projection.currentDayExtrapolated).toBe(false);
    expect(Object.keys(repository)).not.toContain("saveTarget");
  });

  it("counts Saturday sales but never adds Saturday to the primary divisor", async () => {
    const repository = createRepository({
      getSnapshotAggregates: vi.fn(async () => ({
        month: { totalAmount: "17000.00", totalSales: 20 },
        today: { totalAmount: "1000.00", totalSales: 2 },
        completed: { totalAmount: "16000.00", totalSales: 18 },
      })),
    });
    const service = createSalesInsightsService(repository);

    const result = await service.getSalesSnapshot(
      selfActor,
      {},
      new Date("2026-08-29T14:00:00.000Z")
    );

    expect(result.asOf).toMatchObject({
      dayStatus: "in_progress",
      workPeriod: "saturday_half",
    });
    expect(result.totals.todayAmount).toBe("1000.00");
    expect(result.calendar.remainingPrimaryWeekdays).toBe(1);
    expect(result.officialTarget).toMatchObject({
      remainingAmount: "3000.00",
      remainingPrimaryWeekdays: 1,
      requiredPerPrimaryWeekdayFromNow: "3000.00",
      today: null,
    });
  });
});

describe("getSalesPerformance", () => {
  it("excludes the current incomplete day from completed historical averages", async () => {
    const repository = createRepository({
      getDailyAggregates: vi.fn(async () => [
        { date: "2026-08-24", totalAmount: "100.00", totalSales: 1 },
        { date: "2026-08-25", totalAmount: "50.00", totalSales: 1 },
      ]),
    });
    const service = createSalesInsightsService(repository);

    const result = await service.getSalesPerformance(
      selfActor,
      { startDate: "2026-08-23", endDate: "2026-08-25" },
      new Date("2026-08-25T13:00:00.000Z")
    );

    expect(result.period).toMatchObject({
      totalAmount: "150.00",
      totalSales: 2,
    });
    expect(result.series.map(day => day.status)).toEqual([
      "closed",
      "completed",
      "in_progress",
    ]);
    expect(result.completedPerformance).toMatchObject({
      workPeriods: 1,
      capacityUnits: 1,
      averagePerWorkPeriod: "100.00",
      averagePerFullDayEquivalent: "100.00",
    });
    expect(result.completedPerformance.bestDay?.date).toBe("2026-08-24");
    expect(result.completedPerformance.worstDay?.date).toBe("2026-08-24");
    expect(JSON.stringify(result)).not.toContain("clientName");
    expect(JSON.stringify(result)).not.toContain("attachmentKey");
  });

  it("includes a closed Saturday in history with half-day capacity", async () => {
    const repository = createRepository({
      getDailyAggregates: vi.fn(async () => [
        { date: "2026-08-29", totalAmount: "100.00", totalSales: 1 },
      ]),
    });
    const service = createSalesInsightsService(repository);

    const result = await service.getSalesPerformance(
      selfActor,
      { startDate: "2026-08-29", endDate: "2026-08-29" },
      new Date("2026-08-29T15:00:00.000Z")
    );

    expect(result.series[0]).toMatchObject({
      status: "completed",
      workPeriod: "saturday_half",
      capacityUnits: 0.5,
      amount: "100.00",
    });
    expect(result.completedPerformance).toMatchObject({
      workPeriods: 1,
      capacityUnits: 0.5,
      averagePerWorkPeriod: "100.00",
      averagePerFullDayEquivalent: "200.00",
    });
  });

  it("limits performance ranges before querying the repository", async () => {
    const repository = createRepository();
    const service = createSalesInsightsService(repository);

    await expect(
      service.getSalesPerformance(selfActor, {
        startDate: "2025-01-01",
        endDate: "2026-01-02",
      })
    ).rejects.toThrow();
    expect(repository.getSeller).not.toHaveBeenCalled();
    expect(repository.getDailyAggregates).not.toHaveBeenCalled();
  });
});
