import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados ficam "frescos" por 30s — evita re-fetch desnecessário ao trocar de aba
      staleTime: 30_000,
      // Mantém dados anteriores visíveis enquanto recarrega (sem tela em branco)
      // placeholderData: "keepPreviousData" é feito por componente com keepPreviousData
      // Retry apenas 1x em erros de rede (não em erros 4xx/5xx)
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = error.data?.code;
          // Não retentar em erros de autenticação ou validação
          if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "BAD_REQUEST") return false;
        }
        return failureCount < 1;
      },
      retryDelay: 1000,
      // Não re-fetch ao focar a janela (evita queries extras ao voltar para a aba)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry 1x em erros de rede nas mutations
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = error.data?.code;
          if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "BAD_REQUEST" || code === "NOT_FOUND") return false;
        }
        return failureCount < 1;
      },
      retryDelay: 1500,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    if (import.meta.env.DEV) console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    if (import.meta.env.DEV) console.error("[API Mutation Error]", error);
  }
});

// Auto-reload quando um deploy novo invalida os chunks JS cacheados
window.addEventListener("error", (event) => {
  if (
    event.message?.includes("Failed to fetch dynamically imported module") ||
    event.message?.includes("Importing a module script failed")
  ) {
    // Evita loop infinito: só recarrega 1x
    const key = "__reload_after_deploy";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (!last || now - Number(last) > 10_000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason);
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")
  ) {
    const key = "__reload_after_deploy";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (!last || now - Number(last) > 10_000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
