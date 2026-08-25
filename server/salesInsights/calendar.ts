export const SALES_INSIGHTS_TIME_ZONE = "America/Sao_Paulo";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const saoPauloFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SALES_INSIGHTS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type SalesWorkPeriod =
  | "weekday_full"
  | "saturday_half"
  | "sunday_closed";

export type SalesDayStatus = "completed" | "in_progress" | "closed" | "future";

export interface SalesDateClassification {
  date: string;
  period: SalesWorkPeriod;
  status: SalesDayStatus;
  capacityUnits: number;
}

export interface SalesMonthCalendar {
  localDate: string;
  localTime: string;
  monthStart: string;
  monthEnd: string;
  currentDay: SalesDateClassification;
  totalPrimaryWeekdays: number;
  completedPrimaryWeekdaysBeforeToday: number;
  remainingPrimaryWeekdays: number;
  primaryWeekdaysAfterToday: number;
  completedWorkPeriods: number;
  completedCapacityUnits: number;
  futureCapacityUnitsAfterToday: number;
  completedThroughDate: string | null;
}

interface SaoPauloClock {
  date: string;
  time: string;
}

function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (formatDateOnly(parsed) !== value) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }
  return parsed;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDateOnlyDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function getDateOnlyRange(startDate: string, endDate: string): string[] {
  getDateOnlyDayCount(startDate, endDate);

  const dates: string[] = [];
  for (
    let cursor = startDate;
    cursor <= endDate;
    cursor = addDateOnlyDays(cursor, 1)
  ) {
    dates.push(cursor);
  }
  return dates;
}

export function getDateOnlyDayCount(
  startDate: string,
  endDate: string
): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (startDate > endDate) {
    throw new RangeError("startDate must not be after endDate");
  }
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function getClock(now: Date): SaoPauloClock {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = Object.fromEntries(
    saoPauloFormatter
      .formatToParts(now)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getWorkPeriod(date: string): SalesWorkPeriod {
  const dayOfWeek = parseDateOnly(date).getUTCDay();
  if (dayOfWeek === 0) return "sunday_closed";
  if (dayOfWeek === 6) return "saturday_half";
  return "weekday_full";
}

function getCapacityUnits(period: SalesWorkPeriod): number {
  if (period === "weekday_full") return 1;
  if (period === "saturday_half") return 0.5;
  return 0;
}

export function classifySalesDate(
  date: string,
  now: Date = new Date()
): SalesDateClassification {
  parseDateOnly(date);
  const clock = getClock(now);
  const period = getWorkPeriod(date);
  let status: SalesDayStatus;

  if (date < clock.date) {
    status = period === "sunday_closed" ? "closed" : "completed";
  } else if (date > clock.date) {
    status = "future";
  } else if (period === "sunday_closed") {
    status = "closed";
  } else if (period === "saturday_half" && clock.time >= "12:00") {
    status = "completed";
  } else {
    // O encerramento de segunda a sexta ainda não foi configurado. Por isso,
    // o dia atual permanece incompleto e não entra em médias históricas.
    status = "in_progress";
  }

  return {
    date,
    period,
    status,
    capacityUnits: getCapacityUnits(period),
  };
}

function getMonthBounds(localDate: string): {
  monthStart: string;
  monthEnd: string;
} {
  const [year, month] = localDate.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = formatDateOnly(new Date(Date.UTC(year, month, 0)));
  return { monthStart, monthEnd };
}

export function buildSalesMonthCalendar(
  now: Date = new Date()
): SalesMonthCalendar {
  const clock = getClock(now);
  const { monthStart, monthEnd } = getMonthBounds(clock.date);
  const monthDates = getDateOnlyRange(monthStart, monthEnd);
  const currentDay = classifySalesDate(clock.date, now);
  const primaryDates = monthDates.filter(
    date => getWorkPeriod(date) === "weekday_full"
  );
  const completedDates = monthDates.filter(
    date => classifySalesDate(date, now).status === "completed"
  );
  const remainingPrimaryDates = primaryDates.filter(date => date >= clock.date);
  const primaryDatesAfterToday = primaryDates.filter(date => date > clock.date);
  const futureDatesAfterToday = monthDates.filter(date => date > clock.date);
  const completedThroughDate =
    currentDay.status === "completed"
      ? clock.date
      : clock.date === monthStart
        ? null
        : addDateOnlyDays(clock.date, -1);

  return {
    localDate: clock.date,
    localTime: clock.time,
    monthStart,
    monthEnd,
    currentDay,
    totalPrimaryWeekdays: primaryDates.length,
    completedPrimaryWeekdaysBeforeToday: primaryDates.filter(
      date => date < clock.date
    ).length,
    remainingPrimaryWeekdays: remainingPrimaryDates.length,
    primaryWeekdaysAfterToday: primaryDatesAfterToday.length,
    completedWorkPeriods: completedDates.length,
    completedCapacityUnits: completedDates.reduce(
      (total, date) => total + getCapacityUnits(getWorkPeriod(date)),
      0
    ),
    futureCapacityUnitsAfterToday: futureDatesAfterToday.reduce(
      (total, date) => total + getCapacityUnits(getWorkPeriod(date)),
      0
    ),
    completedThroughDate,
  };
}
