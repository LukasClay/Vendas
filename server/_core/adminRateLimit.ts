import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

type AdminRateLimitAction = "resetPassword" | "sales.exportCsv" | "reports.exportData";

type RateLimitEntry = {
  count: number;
  firstAttempt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;
const actionLimits: Record<AdminRateLimitAction, number> = {
  resetPassword: 5,
  "sales.exportCsv": 10,
  "reports.exportData": 10,
};

const adminActionAttempts = new Map<string, RateLimitEntry>();

function getClientIp(ctx: TrpcContext): string {
  return (
    ctx.ipAddress ||
    ctx.req.ip ||
    (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    ctx.req.socket?.remoteAddress ||
    "unknown"
  );
}

export function checkAdminActionRateLimit(
  ctx: TrpcContext & { user: NonNullable<TrpcContext["user"]> },
  action: AdminRateLimitAction,
  now = Date.now()
): void {
  const key = `${action}:${ctx.user.id}:${getClientIp(ctx)}`;
  const maxAttempts = actionLimits[action];
  const entry = adminActionAttempts.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    if (adminActionAttempts.size >= MAX_ENTRIES) {
      adminActionAttempts.clear();
    }
    adminActionAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }

  entry.count += 1;
  if (entry.count > maxAttempts) {
    const retryAfterMin = Math.ceil(
      (WINDOW_MS - (now - entry.firstAttempt)) / 60000
    );
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Muitas solicitações administrativas. Tente novamente em ${retryAfterMin} minuto(s).`,
    });
  }
}

export function resetAdminActionRateLimitForTest(): void {
  adminActionAttempts.clear();
}
