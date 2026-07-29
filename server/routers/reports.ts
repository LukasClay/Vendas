import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sendEmail, isEmailConfigured } from "../email";
import {
  createReportSchedule,
  deleteReportSchedule,
  getReportSchedules,
  getReportSummary,
  getReportSummaryByCompany,
  getSales,
  getSalesByMonth,
  getSalesByMonthByCompany,
  getSalesByPeriod,
  getSalesLast14Days,
  getTopClients,
  getTopProducts,
  getTopSellers,
  updateReportSchedule,
  getDb,
} from "../db";
import { adminProcedure, router } from "../_core/trpc";
import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { sales, users } from "../../drizzle/schema";
import { calcDeadline } from "../../shared/businessDays";
import { toPublicSale } from "../saleMedia";

export const reportsRouter = router({
  summary: adminProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const sd = input?.startDate ? new Date(input.startDate) : undefined;
      const ed = input?.endDate ? new Date(input.endDate) : undefined;
      const [summary, topSellers, topClients, topProducts, summaryByCompany] =
        await Promise.all([
          getReportSummary(sd, ed),
          getTopSellers(sd, ed),
          getTopClients(sd, ed),
          getTopProducts(sd, ed),
          getReportSummaryByCompany(sd, ed),
        ]);
      return { summary, topSellers, topClients, topProducts, summaryByCompany };
    }),

  salesByMonth: adminProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      return getSalesByMonth(input.year);
    }),

  salesLast14Days: adminProcedure.query(async () => {
    return getSalesLast14Days();
  }),

  // Gráfico do dashboard ADM: agrega vendas por dia ou mês em qualquer janela.
  // Sem startDate/endDate = "Total" (desde a venda mais antiga, sem comparação).
  // compareEndDate: corte de "atual decorrido" para comparação justa quando
  //   o período está em andamento (ex: hoje no dia 10 → soma só 1..10).
  // previousStartDate/EndDate: janela explícita do período anterior (ex: para
  //   "Este mês" no dia 10 → 1..10 do mês passado, em vez do mês todo).
  salesByPeriod: adminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        granularity: z.enum(["day", "month"]),
        compareEndDate: z.string().optional(),
        previousStartDate: z.string().optional(),
        previousEndDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getSalesByPeriod({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        granularity: input.granularity,
        compareEndDate: input.compareEndDate
          ? new Date(input.compareEndDate)
          : undefined,
        previousStartDate: input.previousStartDate
          ? new Date(input.previousStartDate)
          : undefined,
        previousEndDate: input.previousEndDate
          ? new Date(input.previousEndDate)
          : undefined,
      });
    }),

  currentMonthMetrics: adminProcedure.query(async () => {
    // Calcula "mês atual" no fuso do Brasil, independente do TZ do servidor (Railway roda em UTC).
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) =>
      Number(parts.find(p => p.type === t)?.value ?? 0);
    const year = get("year");
    const month = get("month");
    const day = get("day");

    const firstOfMonth = new Date(year, month - 1, 1);
    const today = new Date(year, month - 1, day);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Mês passado: 1º até último dia, e 1º até o "mesmo dia" do mês passado
    // (limitado ao último dia daquele mês, p/ casos como 31/jan vs fev).
    const firstOfLastMonth = new Date(year, month - 2, 1);
    const lastOfLastMonth = new Date(year, month - 1, 0);
    const daysInLastMonth = lastOfLastMonth.getDate();
    const sameDayLastMonth = new Date(
      year,
      month - 2,
      Math.min(day, daysInLastMonth)
    );

    const [summary, lastMonthSummary, lastMonthSamePeriodSummary] =
      await Promise.all([
        getReportSummary(firstOfMonth, today),
        getReportSummary(firstOfLastMonth, lastOfLastMonth),
        getReportSummary(firstOfLastMonth, sameDayLastMonth),
      ]);

    const totalAmount = Number(summary.totalAmount ?? 0);
    const totalSales = Number(summary.totalSales ?? 0);
    const daysElapsed = day;
    const dailyAverage = daysElapsed > 0 ? totalAmount / daysElapsed : 0;
    const projectedTotal = dailyAverage * daysInMonth;

    const lastMonthTotal = Number(lastMonthSummary.totalAmount ?? 0);
    const lastMonthSales = Number(lastMonthSummary.totalSales ?? 0);
    const lastMonthDailyAverage =
      daysInLastMonth > 0 ? lastMonthTotal / daysInLastMonth : 0;

    const lastMonthSamePeriodTotal = Number(
      lastMonthSamePeriodSummary.totalAmount ?? 0
    );
    const lastMonthSamePeriodSales = Number(
      lastMonthSamePeriodSummary.totalSales ?? 0
    );
    const lastMonthSamePeriodDailyAverage =
      daysElapsed > 0 ? lastMonthSamePeriodTotal / daysElapsed : 0;

    return {
      totalAmount,
      totalSales,
      daysElapsed,
      daysInMonth,
      dailyAverage,
      projectedTotal,
      lastMonthTotal,
      lastMonthSales,
      lastMonthDailyAverage,
      lastMonthSamePeriodTotal,
      lastMonthSamePeriodSales,
      lastMonthSamePeriodDailyAverage,
    };
  }),

  salesByMonthByCompany: adminProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      return getSalesByMonthByCompany(input.year);
    }),

  slaMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [completedRows, inProgressRows] = await Promise.all([
      db
        .select({
          saleDate: sales.saleDate,
          completedAt: sales.completedAt,
        })
        .from(sales)
        .where(
          and(
            eq(sales.workStatus, "feito"),
            ne(sales.productName, "Consulta Cartas"),
            ne(sales.productCategory, "coletivo"),
            isNull(sales.deletedAt)
          )
        )
        .limit(5000),
      db
        .select({ saleDate: sales.saleDate })
        .from(sales)
        .where(
          and(
            or(
              eq(sales.workStatus, "para_escrever"),
              eq(sales.workStatus, "pendente")
            ),
            ne(sales.productName, "Consulta Cartas"),
            ne(sales.productCategory, "coletivo"),
            isNull(sales.deletedAt)
          )
        )
        .limit(5000),
    ]);

    let completedOnTime = 0;
    let completedLate = 0;
    for (const row of completedRows) {
      if (!row.completedAt) {
        completedLate++;
        continue;
      }
      const deadline = calcDeadline(String(row.saleDate));
      deadline.setHours(0, 0, 0, 0);
      const done = new Date(row.completedAt);
      done.setHours(0, 0, 0, 0);
      if (done <= deadline) completedOnTime++;
      else completedLate++;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let overdueCount = 0;
    for (const row of inProgressRows) {
      const deadline = calcDeadline(String(row.saleDate));
      deadline.setHours(0, 0, 0, 0);
      if (today > deadline) overdueCount++;
    }

    const total = completedOnTime + completedLate;
    const slaRate =
      total > 0 ? Math.round((completedOnTime / total) * 100) : null;

    return {
      completedOnTime,
      completedLate,
      slaRate,
      inProgressCount: inProgressRows.length,
      overdueCount,
    };
  }),

  sellerGoalsCurrentMonth: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) =>
      Number(parts.find(p => p.type === t)?.value ?? 0);
    const year = get("year");
    const month = get("month");
    const day = get("day");
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const today = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const usersWithGoals = await db
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
          eq(users.active, true),
          isNull(users.deletedAt),
          isNotNull(users.monthlyGoal)
        )
      );

    if (usersWithGoals.length === 0) return [];

    const sellerIds = usersWithGoals.map(u => u.id);
    const salesRows = await db
      .select({
        sellerId: sales.sellerId,
        total: sql<string>`SUM(${sales.amount})`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, firstOfMonth),
          lte(sales.saleDate, today),
          isNull(sales.deletedAt),
          inArray(sales.sellerId, sellerIds)
        )
      )
      .groupBy(sales.sellerId);

    const salesMap = new Map(
      salesRows.map(r => [r.sellerId, Number(r.total ?? 0)])
    );

    return usersWithGoals.map(u => ({
      id: u.id,
      name: u.displayName || u.name || "Sem nome",
      role: u.role,
      monthlyGoal: Number(u.monthlyGoal),
      currentMonthTotal: salesMap.get(u.id) ?? 0,
    }));
  }),

  exportData: adminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        sellerId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const salesData = await getSales({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        sellerId: input.sellerId,
        limit: 5000,
      });

      if (salesData.length >= 5000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A exportação retornou 5.000+ registros. Refine os filtros de data ou vendedor para no máximo 5.000 registros por exportação.",
        });
      }

      return salesData.map(row => ({
        ...row,
        sale: toPublicSale(row.sale),
      }));
    }),

  // Agendamento de relatórios por email
  schedules: adminProcedure.query(async () => {
    return getReportSchedules();
  }),

  createSchedule: adminProcedure
    .input(
      z.object({
        frequency: z.enum(["daily", "weekly", "monthly"]),
        recipientEmail: z.string().email("Email inválido"),
      })
    )
    .mutation(async ({ input }) => {
      await createReportSchedule({
        frequency: input.frequency,
        recipientEmail: input.recipientEmail,
        active: true,
      });
      return { success: true };
    }),

  updateSchedule: adminProcedure
    .input(
      z.object({
        id: z.number(),
        active: z.boolean().optional(),
        recipientEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateReportSchedule(id, data);
      return { success: true };
    }),

  deleteSchedule: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteReportSchedule(input.id);
      return { success: true };
    }),

  sendTestEmail: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      if (!isEmailConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Servico de email nao configurado. Verifique a variavel RESEND_API_KEY.",
        });
      }
      const sent = await sendEmail({
        to: input.email,
        subject: "Mundo Da Magia - Teste de Email",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', sans-serif; background: #fdf8f0; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e8dcc8;">
    <div style="background: linear-gradient(135deg, #c17f24, #a0651a); color: white; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">Mundo Da Magia LTDA</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Teste de Email</p>
    </div>
    <div style="padding: 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <h2 style="color: #333; margin: 0 0 12px;">Email funcionando!</h2>
      <p style="color: #666; margin: 0;">O sistema de relatorios automaticos esta configurado corretamente.<br>Voce recebera relatorios automaticos conforme o agendamento configurado.</p>
    </div>
    <div style="padding: 16px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #f0e8d8;">
      Mundo Da Magia LTDA - Email automatico de teste
    </div>
  </div>
</body>
</html>`,
      });
      if (!sent)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao enviar email. Verifique os logs do servidor.",
        });
      return { success: true };
    }),
});
