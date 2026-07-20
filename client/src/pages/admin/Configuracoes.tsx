import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { User, Shield, Bell } from "lucide-react";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { useTheme } from "@/contexts/ThemeContext";

export default function AdminConfiguracoes() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <h1
              className="text-2xl font-bold"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--foreground)",
              }}
            >
              Minha Conta
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Seu perfil e informações do sistema
            </p>
          </div>
        </FadeIn>

        <StaggerList className="space-y-4">
          {/* Perfil */}
          <StaggerItem>
            <div
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--secondary)" }}
                >
                  <User
                    className="w-5 h-5"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <h2
                  className="font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  Meu Perfil
                </h2>
              </div>
              <div className="space-y-3">
                <div
                  className="flex justify-between items-center py-2 border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Nome
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {user?.name || "—"}
                  </span>
                </div>
                <div
                  className="flex justify-between items-center py-2 border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Login
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {user?.username || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Nível de acesso
                  </span>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: "var(--secondary)",
                      color: "var(--primary)",
                    }}
                  >
                    Administrador
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* Sistema */}
          <StaggerItem>
            <div
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: isDark
                      ? "var(--secondary)"
                      : "oklch(0.92 0.04 250)",
                  }}
                >
                  <Shield
                    className="w-5 h-5"
                    style={{
                      color: isDark ? "var(--primary)" : "oklch(0.50 0.18 250)",
                    }}
                  />
                </div>
                <h2
                  className="font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  Sobre o Sistema
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  ["Sistema", "MagiSys"],
                  ["Versão", "2.15.2"],
                  ["Banco de Dados", "PostgreSQL"],
                  ["Armazenamento", "10GB/mês"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {label}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>

          {/* Relatórios automáticos */}
          <StaggerItem>
            <div
              className="rounded-2xl p-6 shadow-xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--secondary)" }}
                >
                  <Bell
                    className="w-5 h-5"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <h2
                  className="font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  Relatórios Automáticos
                </h2>
              </div>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Configure o envio automático de relatórios por email na página
                de{" "}
                <a
                  href="/admin/relatorios"
                  className="font-semibold underline"
                  style={{ color: "var(--primary)" }}
                >
                  Relatórios
                </a>
                . Você pode configurar envios diários, semanais e mensais para
                qualquer email.
              </p>
            </div>
          </StaggerItem>
        </StaggerList>
      </div>
    </DashboardLayout>
  );
}
