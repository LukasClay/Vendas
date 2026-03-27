import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ArrowLeftRight, Loader2, Shield } from "lucide-react";

const COMPANIES = {
  mundo_da_magia: {
    name: "Mundo Da Magia LTDA",
    short: "Mundo Da Magia",
    color: "#7c3aed",       // roxo Nubank
    bg: "rgba(124, 58, 237, 0.1)",
    border: "rgba(124, 58, 237, 0.3)",
  },
  mundo_cigano: {
    name: "Mundo Cigano LTDA",
    short: "Mundo Cigano",
    color: "#d97706",       // âmbar/laranja Inter
    bg: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.3)",
  },
} as const;

export type CompanyKey = keyof typeof COMPANIES;

export function getCompanyInfo(key: string | null | undefined) {
  if (key === "mundo_cigano") return COMPANIES.mundo_cigano;
  return COMPANIES.mundo_da_magia;
}

export function CompanyBadge({ company }: { company: string | null | undefined }) {
  const info = getCompanyInfo(company);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}
    >
      <Building2 className="w-2.5 h-2.5" />
      {info.short}
    </span>
  );
}

export default function CompanySwitch() {
  const [showModal, setShowModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: activeCompany, isLoading } = trpc.settings.getActiveCompany.useQuery(undefined, {
    staleTime: 30_000,
  });

  const switchMutation = trpc.settings.switchCompany.useMutation({
    onSuccess: (data) => {
      const info = getCompanyInfo(data.company);
      toast.success(`Empresa ativa alterada para ${info.name}`);
      utils.settings.getActiveCompany.invalidate();
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const current = getCompanyInfo(activeCompany);
  const targetKey: CompanyKey = activeCompany === "mundo_cigano" ? "mundo_da_magia" : "mundo_cigano";
  const target = COMPANIES[targetKey];

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4 border border-[var(--border)] bg-[var(--card)] animate-pulse">
        <div className="h-10 rounded-xl bg-[var(--secondary)]" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 shadow-xl border"
        style={{
          background: "var(--card)",
          borderColor: current.border,
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: current.bg }}
            >
              <Building2 className="w-5 h-5" style={{ color: current.color }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Empresa Ativa
              </p>
              <p className="text-base font-bold" style={{ color: current.color, fontFamily: "'Playfair Display', serif" }}>
                {current.name}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "var(--secondary)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Trocar Empresa
          </motion.button>
        </div>
      </motion.div>

      {/* Modal de Confirmação */}
      <AnimatePresence>
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-[var(--border)]"
              style={{ background: "var(--card)" }}
            >
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: target.bg }}
                >
                  <Shield className="w-8 h-8" style={{ color: target.color }} />
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>
                  Trocar Empresa Ativa
                </h3>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Tem certeza que deseja trocar a empresa ativa?
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--secondary)", opacity: 0.6 }}>
                  <Building2 className="w-5 h-5 shrink-0" style={{ color: current.color }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Atual</p>
                    <p className="text-sm font-bold" style={{ color: current.color }}>{current.name}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowLeftRight className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ background: target.bg, borderColor: target.border }}>
                  <Building2 className="w-5 h-5 shrink-0" style={{ color: target.color }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nova empresa</p>
                    <p className="text-sm font-bold" style={{ color: target.color }}>{target.name}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl mb-6" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                  Todas as <strong style={{ color: "var(--foreground)" }}>novas vendas</strong> serão registradas em{" "}
                  <strong style={{ color: target.color }}>{target.name}</strong>.
                  <br />
                  Vendas anteriores não serão alteradas.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: "var(--secondary)", color: "var(--foreground)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => switchMutation.mutate({ company: targetKey })}
                  disabled={switchMutation.isPending}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: target.color }}
                >
                  {switchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="w-4 h-4" />
                  )}
                  Confirmar Troca
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
