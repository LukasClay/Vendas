import { toast } from "sonner";

// Extrai mensagem de qualquer erro de forma segura.
export function errorMessage(
  err: unknown,
  fallback = "Erro inesperado."
): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

// Handler padrão para `onError` de mutações tRPC. Substitui o antigo
// `(err: any) => toast.error(err.message)`.
export function showError(err: unknown): void {
  toast.error(errorMessage(err));
}
