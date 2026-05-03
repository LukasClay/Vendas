import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useAdminSSE() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;

    const flush = () => {
      const channels = new Set(pending.current);
      pending.current.clear();

      for (const ch of channels) {
        if (ch === "sales") {
          utils.sales.list.invalidate();
          utils.sales.listDeleted.invalidate();
          utils.reports.summary.invalidate();
          utils.reports.salesByPeriod.invalidate();
          utils.reports.currentMonthMetrics.invalidate();
          utils.reports.slaMetrics.invalidate();
          utils.reports.sellerGoalsCurrentMonth.invalidate();
          utils.consultora.worksSummary.invalidate();
          utils.consultora.statusCounts.invalidate();
        } else if (ch === "consultora") {
          utils.consultora.worksSummary.invalidate();
          utils.consultora.statusCounts.invalidate();
          utils.consultora.alerts.invalidate();
          utils.reports.slaMetrics.invalidate();
        } else if (ch === "users") {
          utils.users.listAll.invalidate();
          utils.reports.sellerGoalsCurrentMonth.invalidate();
        } else if (ch === "products") {
          utils.products.listAll.invalidate();
        }
      }
    };

    const source = new EventSource("/api/events");

    source.onmessage = (e: MessageEvent<string>) => {
      pending.current.add(e.data);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
    };

    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user?.role, utils]);
}
