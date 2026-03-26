import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * CompanyThemeProvider
 * 
 * Injeta CSS variables dinâmicas no :root baseado na empresa ativa.
 * Mundo Da Magia = dourado/âmbar (padrão, não muda nada)
 * Mundo Cigano = roxo/lilás (sobrescreve --primary e derivados)
 * 
 * Só é renderizado dentro do painel admin.
 */

// Cores da Mundo Cigano (roxo/lilás) para sobrescrever o tema dourado padrão
const CIGANO_LIGHT = {
  "--primary": "oklch(0.55 0.20 285)",
  "--primary-foreground": "oklch(1 0 0)",
  "--ring": "oklch(0.55 0.20 285)",
  "--chart-1": "oklch(0.55 0.20 285)",
  "--sidebar-primary": "oklch(0.55 0.20 285)",
  "--sidebar-ring": "oklch(0.55 0.20 285)",
  "--secondary": "oklch(0.94 0.02 285)",
  "--accent": "oklch(0.94 0.03 285)",
};

const CIGANO_DARK = {
  "--primary": "oklch(0.68 0.20 285)",
  "--primary-foreground": "oklch(0.15 0.02 260)",
  "--ring": "oklch(0.68 0.20 285)",
  "--chart-1": "oklch(0.68 0.20 285)",
  "--sidebar-primary": "oklch(0.68 0.20 285)",
  "--sidebar-ring": "oklch(0.68 0.20 285)",
  "--secondary": "oklch(0.22 0.025 285)",
  "--accent": "oklch(0.24 0.025 285)",
};

// Cores originais da Mundo Da Magia (dourado) para restaurar
const MAGIA_LIGHT = {
  "--primary": "oklch(0.60 0.13 65)",
  "--primary-foreground": "oklch(1 0 0)",
  "--ring": "oklch(0.60 0.13 65)",
  "--chart-1": "oklch(0.60 0.13 65)",
  "--sidebar-primary": "oklch(0.60 0.13 65)",
  "--sidebar-ring": "oklch(0.60 0.13 65)",
  "--secondary": "oklch(0.94 0.012 65)",
  "--accent": "oklch(0.94 0.02 65)",
};

const MAGIA_DARK = {
  "--primary": "oklch(0.68 0.14 65)",
  "--primary-foreground": "oklch(0.15 0.02 260)",
  "--ring": "oklch(0.68 0.14 65)",
  "--chart-1": "oklch(0.68 0.14 65)",
  "--sidebar-primary": "oklch(0.68 0.14 65)",
  "--sidebar-ring": "oklch(0.68 0.14 65)",
  "--secondary": "oklch(0.22 0.015 265)",
  "--accent": "oklch(0.24 0.015 265)",
};

function applyCompanyTheme(company: string, isDark: boolean) {
  const root = document.documentElement;
  const vars = company === "mundo_cigano"
    ? (isDark ? CIGANO_DARK : CIGANO_LIGHT)
    : (isDark ? MAGIA_DARK : MAGIA_LIGHT);

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearCompanyTheme() {
  const root = document.documentElement;
  const allKeys = Object.keys(CIGANO_LIGHT);
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
