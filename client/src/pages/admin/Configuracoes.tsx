import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Settings, User, Shield, Bell } from "lucide-react";

export default function AdminConfiguracoes() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Minha Conta
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
            Seu perfil e informações do sistema
          </p>
        </div>

        <div className="space-y-4">
          {/* Perfil */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.94 0.02 65)" }}>
                <User className="w-5 h-5" style={{ color: "oklch(0.60 0.13 65)" }} />
              </div>
              <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Meu Perfil</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                <span className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>Nome</span>
                <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{user?.name || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                <span className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>Email</span>
                <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{user?.email || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>Nível de acesso</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                  Administrador
                </span>
              </div>
            </div>
          </div>

          {/* Sistema */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.92 0.04 250)" }}>
                <Shield className="w-5 h-5" style={{ color: "oklch(0.50 0.18 250)" }} />
              </div>
              <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Sobre o Sistema</h2>
            </div>
            <div className="space-y-3">
              {[
                ["Sistema", "Gestão de Vendas Espirituais"],
                ["Versão", "1.8.0"],
                ["Banco de Dados", "PostgreSQL"],
                ["Armazenamento", "S3 (5GB inicial)"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b last:border-0"
                  style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  <span className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relatórios automáticos */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "oklch(0.96 0.02 65)", border: "1px solid oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-5 h-5" style={{ color: "oklch(0.60 0.13 65)" }} />
              <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Relatórios Automáticos</h2>
            </div>
            <p className="text-sm" style={{ color: "oklch(0.40 0.02 260)" }}>
              Configure o envio automático de relatórios por email na página de{" "}
              <a href="/admin/relatorios" className="font-semibold underline" style={{ color: "oklch(0.50 0.12 65)" }}>
                Relatórios
              </a>.
              Você pode configurar envios diários, semanais e mensais para qualquer email.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
