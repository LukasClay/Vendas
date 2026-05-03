import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, ShoppingBag, User, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const ROLE_LABELS: Record<string, string> = {
  user: "Funcionário",
  consultora: "Consultora",
  admin: "Admin",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isFetching } = trpc.search.query.useQuery(
    { q: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 30_000,
    }
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [onClose, navigate]
  );

  const hasResults =
    data &&
    (data.clients.length > 0 || data.sales.length > 0 || data.users.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <div className="flex items-center px-3 border-b border-[var(--border)]">
        <CommandInput
          placeholder="Buscar clientes, vendas, funcionários..."
          value={query}
          onValueChange={setQuery}
          className="flex-1"
        />
        {isFetching && (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 ml-2" style={{ color: "var(--muted-foreground)" }} />
        )}
      </div>
      <CommandList>
        {debouncedQuery.length < 2 ? (
          <div className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            Digite ao menos 2 caracteres para buscar.
          </div>
        ) : !hasResults && !isFetching ? (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        ) : null}

        {data?.clients && data.clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {data.clients.map(c => (
              <CommandItem
                key={`client-${c.id}`}
                onSelect={() => go(`/admin/vendas?cliente=${encodeURIComponent(c.fullName)}`)}
                className="cursor-pointer"
              >
                <Users className="w-4 h-4 mr-2 shrink-0" style={{ color: "var(--primary)" }} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.fullName}</p>
                  {c.phone && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{c.phone}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data?.clients && data.clients.length > 0 && data.sales && data.sales.length > 0 && (
          <CommandSeparator />
        )}

        {data?.sales && data.sales.length > 0 && (
          <CommandGroup heading="Vendas">
            {data.sales.map(s => (
              <CommandItem
                key={`sale-${s.id}`}
                onSelect={() => go(`/admin/vendas`)}
                className="cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 mr-2 shrink-0" style={{ color: "var(--primary)" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.clientName}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {s.productName} · {formatCurrency(s.amount)} · {formatDate(s.saleDate)}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data?.sales && data.sales.length > 0 && data.users && data.users.length > 0 && (
          <CommandSeparator />
        )}

        {data?.users && data.users.length > 0 && (
          <CommandGroup heading="Funcionários">
            {data.users.map(u => (
              <CommandItem
                key={`user-${u.id}`}
                onSelect={() => go("/admin/vendedores")}
                className="cursor-pointer"
              >
                <User className="w-4 h-4 mr-2 shrink-0" style={{ color: "var(--primary)" }} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.displayName || u.name || u.username}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {ROLE_LABELS[u.role] ?? u.role}
                    {u.username ? ` · @${u.username}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
