import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * CompanyThemeProvider
 * 
 * Injeta CSS variables dinâmicas no :root baseado na empresa ativa.
 * Mundo Da Magia = Roxo (#7C3AED) — estilo Nubank
 * Mundo Cigano = Âmbar/Laranja (#D97706) — estilo Inter
 * 
 * Só é renderizado dentro do painel admin.
 * Consultora e Vendedor NÃO usam este provider (mantêm âmbar fixo).
 */

// Mundo Da Magia — Roxo Nubank (#7C3AED)
const MAGIA_LIGHT = {
  "--primary": "oklch(0.55 0.25 285)",        // #7C3AED roxo
  "--primary-foreground": "oklch(1 0 0)",
  "--ring": "oklch(0.55 0.25 285)",
  "--chart-1": "oklch(0.55 0.25 285)",
  "--sidebar-primary": "oklch(0.55 0.25 285)",
  "--sidebar-ring": "oklch(0.55 0.25 285)",
  "--secondary": "oklch(0.95 0.02 285)",
  "--accent": "oklch(0.94 0.03 285)",
};

const MAGIA_DARK = {
  "--primary": "oklch(0.68 0.22 285)",         // roxo mais claro no dark
  "--primary-foreground": "oklch(0.15 0.02 260)",
  "--ring": "oklch(0.68 0.22 285)",
  "--chart-1": "oklch(0.68 0.22 285)",
  "--sidebar-primary": "oklch(0.68 0.22 285)",
  "--sidebar-ring": "oklch(0.68 0.22 285)",
  "--secondary": "oklch(0.22 0.025 285)",
  "--accent": "oklch(0.24 0.025 285)",
};

// Mundo Cigano — Âmbar/Laranja Inter (#D97706)
const CIGANO_LIGHT = {
  "--primary": "oklch(0.60 0.16 70)",          // #D97706 âmbar/laranja
  "--primary-foreground": "oklch(1 0 0)",
  "--ring": "oklch(0.60 0.16 70)",
  "--chart-1": "oklch(0.60 0.16 70)",
  "--sidebar-primary": "oklch(0.60 0.16 70)",
  "--sidebar-ring": "oklch(0.60 0.16 70)",
  "--secondary": "oklch(0.95 0.015 70)",
  "--accent": "oklch(0.94 0.02 70)",
};

const CIGANO_DARK = {
  "--primary": "oklch(0.70 0.16 70)",          // âmbar mais claro no dark
  "--primary-foreground": "oklch(0.15 0.02 260)",
  "--ring": "oklch(0.70 0.16 70)",
  "--chart-1": "oklch(0.70 0.16 70)",
  "--sidebar-primary": "oklch(0.70 0.16 70)",
  "--sidebar-ring": "oklch(0.70 0.16 70)",
  "--secondary": "oklch(0.22 0.015 65)",
  "--accent": "oklch(0.24 0.015 65)",
};

function applyCompanyTheme(company: string, isDark: boolean) {
  const root = document.documentElement;
  const vars = company === "mundo_cigano"
    ? (isDark ? CIGANO_DARK : CIGANO_LIGHT)
    : (isDark ? MAGIA_DARK : MAGIA_LIGHT);

  // Transição suave ao trocar empresa
  root.style.transition = "color 0.3s ease, background-color 0.3s ease";

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Remover transition após aplicar para não afetar outras mudanças
  setTimeout(() => {
    root.style.transition = "";
  }, 400);
}

function clearCompanyTheme() {
  const root = document.documentElement;
  const allKeys = Object.keys(MAGIA_LIGHT);
  for (const key of allKeys) {
    root.style.removeProperty(key);
  }
}

export default function CompanyThemeProvider() {
  const { data: activeCompany } = trpc.settings.getActiveCompany.useQuery(undefined, {
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!activeCompany) return;

    // Detectar tema atual
    const isDark = document.documentElement.classList.contains("dark");
    applyCompanyTheme(activeCompany, isDark);

    // Observer para reagir a mudanças de tema (light/dark toggle)
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      applyCompanyTheme(activeCompany, nowDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      clearCompanyTheme();
    };
  }, [activeCompany]);

  return null; // Componente invisível, só injeta CSS
}
