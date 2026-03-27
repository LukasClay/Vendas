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
      const sd = input?.startDate ? new Date(input.startDate) : undefined;
      const ed = input?.endDate ? new Date(input.endDate) : undefined;
      const [summary, topSellers, topClients, topProducts, summaryByCompany] = await Promise.all([
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

  salesByMonthByCompany: adminProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      return getSalesByMonthByCompany(input.year);
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

  sendTestEmail: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      if (!isEmailConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Servico de email nao configurado. Verifique a variavel RESEND_API_KEY." });
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
      if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao enviar email. Verifique os logs do servidor." });
      return { success: true };
    }),
});
