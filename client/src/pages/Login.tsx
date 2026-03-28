import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(1, "Senha obrigatória"),
  rememberMe: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "consultora") navigate("/consultora");
      else navigate("/venda");
    }
  }, [user, loading, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", rememberMe: true },
  });

  const loginMutation = trpc.ownAuth.login.useMutation({
    onSuccess: (data) => {
      setLoginError(null);
      toast.success("Login realizado com sucesso!");
      setTimeout(() => {
        if (data.role === "admin") window.location.href = "/admin";
        else if (data.role === "consultora") window.location.href = "/consultora";
        else window.location.href = "/venda";
      }, 300);
    },
    onError: (err) => {
      const msg = err.message || "Usuário ou senha incorretos.";
      setLoginError(msg);
      toast.error(msg);
    },
  });

  if (loading || user) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, oklch(0.12 0.02 260) 0%, oklch(0.18 0.04 260) 50%, oklch(0.14 0.03 50) 100%)" }}
    >
      {/* Decorative orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.13 65), transparent)" }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-5 pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.13 65), transparent)" }} />

      <div className="w-full max-w-md relative z-10">
        <div className="rounded-3xl p-8 shadow-2xl" style={{ background: "white" }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" opacity="0.95" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-center"
              style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Mundo Da Magia LTDA
            </h1>
            <p className="text-sm mt-1 text-center" style={{ color: "oklch(0.52 0.015 260)" }}>
              Entre com seu usuário e senha para acessar
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "oklch(0.90 0.010 65)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.60 0.13 65)" }} />
            <div className="flex-1 h-px" style={{ background: "oklch(0.90 0.010 65)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d: LoginForm) => { setLoginError(null); loginMutation.mutate(d); })} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "oklch(0.25 0.02 260)" }}>
                Usuário
              </label>
              <input
                {...register("username")}
                type="text"
                placeholder="seu_usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                style={{
                  background: "oklch(0.97 0.005 260)",
                  border: `2px solid ${errors.username ? "oklch(0.55 0.20 25)" : "oklch(0.88 0.012 65)"}`,
                  color: "oklch(0.15 0.02 260)",
                  fontSize: "16px",
                }}
                onChange={(e) => { register("username").onChange(e); setLoginError(null); }}
              />
              {errors.username && (
                <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.20 25)" }}>{errors.username.message}</p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "oklch(0.25 0.02 260)" }}>
                Senha
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl outline-none transition-all"
                  style={{
                    background: "oklch(0.97 0.005 260)",
                    border: `2px solid ${errors.password ? "oklch(0.55 0.20 25)" : "oklch(0.88 0.012 65)"}`,
                    color: "oklch(0.15 0.02 260)",
                    fontSize: "16px",
                  }}
                  onChange={(e) => { register("password").onChange(e); setLoginError(null); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "oklch(0.52 0.015 260)" }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.20 25)" }}>{errors.password.message}</p>
              )}
            </div>

            {/* Lembrar de mim */}
            <div className="flex items-center gap-3">
              <input
                {...register("rememberMe")}
                type="checkbox"
                id="rememberMe"
                className="w-5 h-5 rounded cursor-pointer accent-amber-700"
              />
              <label htmlFor="rememberMe" className="text-sm cursor-pointer select-none text-gray-600">
                Lembrar de mim por 1 ano
              </label>
            </div>

            {/* Mensagem de erro inline */}
            {loginError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", color: "#b91c1c" }}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">{loginError}</p>
              </div>
            )}

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: loginMutation.isPending
                  ? "oklch(0.75 0.08 65)"
                  : "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))",
                fontSize: "16px",
                cursor: loginMutation.isPending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px oklch(0.60 0.13 65 / 0.35)",
              }}
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar no Sistema
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "oklch(0.65 0.01 260)" }}>
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
