import { describe, expect, it } from "vitest";
import {
  buildSalesMonthCalendar,
  classifySalesDate,
  getDateOnlyDayCount,
} from "./calendar";

describe("Sales Insights calendar", () => {
  it("uses the Sao Paulo date at UTC boundaries", () => {
    const now = new Date("2026-08-26T01:30:00.000Z");

    expect(classifySalesDate("2026-08-25", now)).toMatchObject({
      status: "in_progress",
      period: "weekday_full",
    });
    expect(buildSalesMonthCalendar(now).localDate).toBe("2026-08-25");
  });

  it("keeps future Saturdays out of the primary target divisor", () => {
    const fridayMorning = new Date("2026-08-28T13:00:00.000Z");
    const calendar = buildSalesMonthCalendar(fridayMorning);

    expect(calendar.currentDay).toMatchObject({
      period: "weekday_full",
      status: "in_progress",
    });
    expect(calendar.remainingPrimaryWeekdays).toBe(2);
    expect(calendar.primaryWeekdaysAfterToday).toBe(1);
    expect(calendar.futureCapacityUnitsAfterToday).toBe(1.5);
  });

  it("treats Saturday as supplemental and closes it at noon", () => {
    const beforeNoon = buildSalesMonthCalendar(
      new Date("2026-08-29T14:59:00.000Z")
    );
    const atNoon = buildSalesMonthCalendar(
      new Date("2026-08-29T15:00:00.000Z")
    );

    expect(beforeNoon.currentDay).toMatchObject({
      period: "saturday_half",
      status: "in_progress",
      capacityUnits: 0.5,
    });
    expect(beforeNoon.remainingPrimaryWeekdays).toBe(1);
    expect(beforeNoon.completedThroughDate).toBe("2026-08-28");

    expect(atNoon.currentDay.status).toBe("completed");
    expect(atNoon.remainingPrimaryWeekdays).toBe(1);
    expect(atNoon.completedThroughDate).toBe("2026-08-29");
  });

  it("marks Sunday as closed with no sales capacity", () => {
    const sunday = new Date("2026-08-30T15:00:00.000Z");

    expect(classifySalesDate("2026-08-30", sunday)).toEqual({
      date: "2026-08-30",
      period: "sunday_closed",
      status: "closed",
      capacityUnits: 0,
    });
  });

  it("validates date-only ranges without timezone drift", () => {
    expect(getDateOnlyDayCount("2026-01-01", "2026-12-31")).toBe(365);
    expect(() => getDateOnlyDayCount("2026-02-30", "2026-03-01")).toThrow(
      RangeError
    );
  });
});
