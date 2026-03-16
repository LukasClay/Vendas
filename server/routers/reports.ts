import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createReportSchedule,
  deleteReportSchedule,
  getReportSchedules,
  getReportSummary,
  getSales,
  getSalesByMonth,
  getTopClients,
  getTopProducts,
  getTopSellers,
  updateReportSchedule,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const reportsRouter = router({
  summary: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const [summary, topSellers, topClients, topProducts] = await Promise.all([
        getReportSummary(
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined,
        ),
        getTopSellers(
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined,
        ),
        getTopClients(
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined,
        ),
        getTopProducts(
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined,
        ),
      ]);
      return { summary, topSellers, topClients, topProducts };
    }),

  salesByMonth: adminProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      return getSalesByMonth(input.year);
    }),

  exportData: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sellerId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const salesData = await getSales({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        sellerId: input.sellerId,
        limit: 10000,
      });
      return salesData;
    }),

  // Agendamento de relatórios por email
  schedules: adminProcedure.query(async () => {
    return getReportSchedules();
  }),

  createSchedule: adminProcedure
    .input(z.object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      recipientEmail: z.string().email("Email inválido"),
    }))
    .mutation(async ({ input }) => {
      await createReportSchedule({ frequency: input.frequency, recipientEmail: input.recipientEmail, active: true });
      return { success: true };
    }),

  updateSchedule: adminProcedure
    .input(z.object({
      id: z.number(),
      active: z.boolean().optional(),
      recipientEmail: z.string().email().optional(),
    }))
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
});
