import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { isAuthenticated, user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/venda");
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, oklch(0.14 0.025 265) 0%, oklch(0.20 0.04 265) 50%, oklch(0.14 0.025 265) 100%)" }}>

      {/* Decorative orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.13 65), transparent)" }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.13 65), transparent)" }} />

      {/* Card central */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-2xl p-10 shadow-2xl"
          style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.012 65)" }}>

          {/* Logo / Ícone */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z"
                  fill="white" opacity="0.9" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-center" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Gestão de Vendas
            </h1>
            <p className="text-sm mt-2 text-center" style={{ color: "oklch(0.52 0.015 260)" }}>
              Sistema de controle e acompanhamento
            </p>
          </div>

          {/* Divider dourado */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px" style={{ background: "oklch(0.88 0.012 65)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.60 0.13 65)" }} />
            <div className="flex-1 h-px" style={{ background: "oklch(0.88 0.012 65)" }} />
          </div>

          {/* Botão de login */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
                Entrar no Sistema
              </span>
            )}
          </button>

          <p className="text-xs text-center mt-6" style={{ color: "oklch(0.65 0.01 260)" }}>
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
