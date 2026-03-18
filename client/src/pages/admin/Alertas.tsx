import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, Clock, RefreshCw, Phone, User } from "lucide-react";
import { useLocation } from "wouter";

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: "para_escrever" | "pendente" }) {
  if (status === "para_escrever") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.94 0.02 260)", color: "oklch(0.40 0.10 260)" }}>
      ✏️ Para Escrever
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.94 0.04 55)", color: "oklch(0.45 0.12 55)" }}>
      ⏳ Pendente
    </span>
  );
}

function UrgencyChip({ daysRemaining, isOverdue }: { daysRemaining: number; isOverdue: boolean }) {
  if (isOverdue) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: "oklch(0.96 0.04 25)", color: "oklch(0.50 0.20 25)", border: "1.5px solid oklch(0.88 0.10 25)" }}>
      <AlertTriangle className="w-3 h-3" />
      {Math.abs(daysRemaining)}d atrasado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: "oklch(0.97 0.04 55)", color: "oklch(0.45 0.18 55)", border: "1.5px solid oklch(0.88 0.10 55)" }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restante{daysRemaining !== 1 ? "s" : ""}
    </span>
  );
}

export default function AdminAlertas() {
  const [, navigate] = useLocation();
  const { data: alerts = [], isLoading, refetch, isFetching } = trpc.consultora.alerts.useQuery(undefined, {
    staleTime: 3 * 60 * 1000, // dados ficam frescos por 3 min; usuário pode forçar atualização manualmente
  });

  const overdueCount = alerts.filter((a: any) => a.isOverdue).length;
  const urgentCount = alerts.filter((a: any) => !a.isOverdue && a.isUrgent).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all active:scale-95 hover:opacity-80"
            style={{ background: "oklch(0.93 0.012 260)", color: "oklch(0.40 0.08 260)" }}>
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "oklch(0.15 0.02 260)" }}>
              🔔 Alertas
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
              Trabalhos com prazo crítico — Para Escrever e Pendentes
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.40 0.10 65)" }}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "oklch(0.97 0.03 25)", border: "1.5px solid oklch(0.90 0.08 25)" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.55 0.15 25)" }}>Atrasados</p>
          <p className="text-3xl font-bold" style={{ color: "oklch(0.50 0.20 25)" }}>{overdueCount}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "oklch(0.98 0.03 55)", border: "1.5px solid oklch(0.90 0.08 55)" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.55 0.15 55)" }}>Urgentes (≤2 dias)</p>
          <p className="text-3xl font-bold" style={{ color: "oklch(0.50 0.18 55)" }}>{urgentCount}</p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "oklch(0.94 0.008 65)" }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "oklch(0.97 0.005 260)", border: "1.5px dashed oklch(0.88 0.012 65)" }}>
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhum alerta no momento</p>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 260)" }}>Todos os trabalhos estão dentro do prazo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((item: any) => {
            const borderColor = item.isOverdue ? "oklch(0.80 0.12 25)" : "oklch(0.82 0.10 55)";
            const bgColor = item.isOverdue ? "oklch(0.99 0.015 25)" : "oklch(0.99 0.010 55)";
            return (
              <div key={item.id} className="rounded-2xl p-4" style={{ background: bgColor, border: `1.5px solid ${borderColor}` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UrgencyChip daysRemaining={item.daysRemaining} isOverdue={item.isOverdue} />
                      <StatusBadge status={item.workStatus} />
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 shrink-0" style={{ color: "oklch(0.55 0.12 65)" }} />
                      <span className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</span>
                      {item.sellerName && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.015 260)", color: "oklch(0.45 0.08 260)" }}>
                          {item.sellerName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium" style={{ color: "oklch(0.50 0.12 65)" }}>
                      {item.productName}
                      {item.productCategory === "promocao" && " ⭐"}
                      {item.productCategory === "coletivo" && " 👥"}
                    </p>
                    {item.clientPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" style={{ color: "oklch(0.55 0.01 260)" }} />
                        <span className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>{item.clientPhone}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: "oklch(0.55 0.01 260)" }}>Venda</p>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.30 0.02 260)" }}>{formatDate(item.saleDate)}</p>
                    <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.01 260)" }}>Prazo</p>
                    <p className="text-sm font-semibold" style={{ color: item.isOverdue ? "oklch(0.50 0.20 25)" : "oklch(0.45 0.18 55)" }}>
                      {formatDate(item.deadline)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
