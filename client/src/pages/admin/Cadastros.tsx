import DashboardLayout from "@/components/DashboardLayout";
import { FadeIn } from "@/components/Animations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  AlertCircle,
  ContactRound,
  Eye,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

type ClientListItem = RouterOutputs["clients"]["adminList"]["items"][number];
type ClientDetail = RouterOutputs["clients"]["adminDetail"];
type ClientRecord = ClientDetail["client"];
type DuplicateGroup = RouterOutputs["clients"]["duplicateGroups"][number];
type CadastrosTab = "clientes" | "duplicidades";

const PAGE_SIZE = 20;
const WORK_STATUS_LABELS: Record<string, string> = {
  para_escrever: "Para escrever",
  pendente: "Pendente",
  feito: "Feito",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPhone(value: string | null | undefined) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  if (!value.startsWith("+") && digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (!value.startsWith("+") && digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function statusClasses(status: string) {
  if (status === "feito") {
    return "bg-green-500/10 text-green-700 dark:text-green-400";
  }
  if (status === "pendente") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center"
    >
      <AlertCircle className="h-9 w-9 text-red-500" />
      <div>
        <p className="font-semibold text-[var(--foreground)]">
          Não foi possível carregar os dados
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

function ClientListSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-label="Carregando clientes">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-52 max-w-full" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
          <Skeleton className="hidden h-8 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}

function ClientEditDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !client) return;
    setFullName(client.fullName);
    setBirthDate(client.birthDate ?? "");
    setPhone(client.phone ?? "");
  }, [client, open]);

  const updateClient = trpc.clients.adminUpdate.useMutation({
    onSuccess: updated => {
      toast.success("Cadastro atualizado com segurança.");
      setConfirmOpen(false);
      onOpenChange(false);
      void Promise.all([
        utils.clients.adminList.invalidate(),
        utils.clients.adminDetail.invalidate({ id: updated.id }),
        utils.clients.duplicateGroups.invalidate(),
      ]);
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") {
        toast.error(
          "Este cadastro foi alterado por outra pessoa. Abra a ficha novamente para revisar os dados atuais."
        );
        setConfirmOpen(false);
        onOpenChange(false);
        if (client) {
          void utils.clients.adminDetail.invalidate({ id: client.id });
        }
        return;
      }
      toast.error(error.message);
    },
  });

  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) setConfirmOpen(false);
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim()) {
      toast.error("Informe o nome completo da cliente.");
      return;
    }
    if (phone.trim() && !/\d/.test(phone)) {
      toast.error("O telefone deve conter números.");
      return;
    }
    setConfirmOpen(true);
  };

  const hasChanges =
    !!client &&
    (fullName.trim() !== client.fullName ||
      (birthDate || null) !== client.birthDate ||
      (phone.trim() || null) !== client.phone);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar cadastro canônico</DialogTitle>
            <DialogDescription>
              A alteração valerá para usos futuros. As vendas anteriores
              manterão os dados registrados na época.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-[var(--foreground)]">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  Esta ação é protegida, registrada em auditoria e não reescreve
                  o histórico de vendas.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="client-full-name" className="text-sm font-medium">
                Nome completo
              </label>
              <input
                id="client-full-name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                maxLength={256}
                required
                autoFocus
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="client-birth-date"
                  className="text-sm font-medium"
                >
                  Data de nascimento
                </label>
                <input
                  id="client-birth-date"
                  type="date"
                  value={birthDate}
                  onChange={event => setBirthDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="client-phone" className="text-sm font-medium">
                  Telefone
                </label>
                <input
                  id="client-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  maxLength={32}
                  placeholder="DDD + número"
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!hasChanges || updateClient.isPending}
              >
                <ShieldCheck className="h-4 w-4" />
                Revisar alteração
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar atualização do cadastro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confira os novos dados. Esta ação ficará registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-[var(--muted-foreground)]">
                Nome
              </dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {fullName.trim()}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium text-[var(--muted-foreground)]">
                  Nascimento
                </dt>
                <dd>{formatDate(birthDate || null)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[var(--muted-foreground)]">
                  Telefone
                </dt>
                <dd>{formatPhone(phone.trim() || null)}</dd>
              </div>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateClient.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!client || updateClient.isPending}
              onClick={event => {
                event.preventDefault();
                if (!client) return;
                updateClient.mutate({
                  id: client.id,
                  fullName: fullName.trim(),
                  birthDate: birthDate || null,
                  phone: phone.trim() || null,
                  expectedUpdatedAt: client.updatedAt.toISOString(),
                });
              }}
            >
              {updateClient.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ClientDetailsDialog({
  clientId,
  onClose,
  onEdit,
}: {
  clientId: number | null;
  onClose: () => void;
  onEdit: (client: ClientRecord) => void;
}) {
  const detailQuery = trpc.clients.adminDetail.useQuery(
    { id: clientId ?? 0 },
    { enabled: clientId !== null, staleTime: 30_000 }
  );
  const data = detailQuery.data;

  return (
    <Dialog
      open={clientId !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-5 pr-12 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle
                className="truncate text-xl sm:text-2xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {data?.client.fullName ?? "Ficha da cliente"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Cadastro canônico e histórico vinculado pelo identificador da
                cliente.
              </DialogDescription>
            </div>
            {data && (
              <Button
                type="button"
                variant="outline"
                className="mr-0 w-fit shrink-0 sm:mr-7"
                onClick={() => onEdit(data.client)}
              >
                <Pencil className="h-4 w-4" />
                Editar cadastro
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-6 sm:px-7">
          {detailQuery.isLoading ? (
            <div className="space-y-6" aria-label="Carregando ficha da cliente">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : detailQuery.isError ? (
            <ErrorState
              message={detailQuery.error.message}
              onRetry={() => void detailQuery.refetch()}
            />
          ) : data ? (
            <div className="space-y-6">
              <section aria-labelledby="client-summary-title">
                <h2 id="client-summary-title" className="sr-only">
                  Resumo da cliente
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Vendas
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                      {data.summary.salesCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Total registrado
                    </p>
                    <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                      {formatCurrency(data.summary.totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Primeira venda
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)]">
                      {formatDate(data.summary.firstSaleDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Última venda
                    </p>
                    <p className="mt-2 font-semibold text-[var(--foreground)]">
                      {formatDate(data.summary.lastSaleDate)}
                    </p>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="canonical-data-title"
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="canonical-data-title"
                      className="font-semibold text-[var(--foreground)]"
                    >
                      Dados canônicos
                    </h2>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Alterações aqui não modificam os snapshots das vendas
                      antigas.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                    ID {data.client.id}
                  </span>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      Nome completo
                    </dt>
                    <dd className="mt-1 font-semibold text-[var(--foreground)]">
                      {data.client.fullName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      Nascimento
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--foreground)]">
                      {formatDate(data.client.birthDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      Telefone
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {formatPhone(data.client.phone)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      Criado em
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--foreground)]">
                      {formatDateTime(data.client.createdAt)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      Última atualização
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--foreground)]">
                      {formatDateTime(data.client.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                aria-labelledby="client-history-title"
                className="space-y-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="client-history-title"
                      className="flex items-center gap-2 font-semibold text-[var(--foreground)]"
                    >
                      <History className="h-4 w-4 text-[var(--primary)]" />
                      Histórico de vendas
                    </h2>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Dados originais preservados no momento de cada venda.
                    </p>
                  </div>
                  {data.summary.salesCount > data.history.length && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Exibindo as {data.history.length} vendas mais recentes
                    </p>
                  )}
                </div>

                {data.history.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
                    <ShoppingBag className="mx-auto h-9 w-9 text-[var(--muted-foreground)]/50" />
                    <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                      Nenhuma venda ativa vinculada
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] lg:block">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <caption className="sr-only">
                            Histórico de vendas de {data.client.fullName}
                          </caption>
                          <thead className="border-b border-[var(--border)] bg-[var(--secondary)]/50 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                            <tr>
                              <th scope="col" className="px-4 py-3">
                                Data
                              </th>
                              <th scope="col" className="px-4 py-3">
                                Trabalho
                              </th>
                              <th scope="col" className="px-4 py-3">
                                Vendedor
                              </th>
                              <th scope="col" className="px-4 py-3">
                                Snapshot da cliente
                              </th>
                              <th scope="col" className="px-4 py-3">
                                Status
                              </th>
                              <th scope="col" className="px-4 py-3 text-right">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {data.history.map(sale => (
                              <tr
                                key={sale.id}
                                className="bg-[var(--card)] align-top"
                              >
                                <td className="whitespace-nowrap px-4 py-3">
                                  {formatDate(sale.saleDate)}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[var(--foreground)]">
                                    {sale.productName}
                                  </p>
                                  <p className="mt-0.5 text-xs capitalize text-[var(--muted-foreground)]">
                                    {(
                                      sale.productCategory ?? "individual"
                                    ).replace("promocao", "promoção")}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  {sale.sellerName ?? "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[var(--foreground)]">
                                    {sale.clientName}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                    {formatPhone(sale.clientPhone)} ·{" "}
                                    {formatDate(sale.clientBirthDate)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(
                                      sale.workStatus
                                    )}`}
                                  >
                                    {WORK_STATUS_LABELS[sale.workStatus] ??
                                      sale.workStatus}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                                  {formatCurrency(sale.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-3 lg:hidden">
                      {data.history.map(sale => (
                        <article
                          key={sale.id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[var(--foreground)]">
                                {sale.productName}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                {formatDate(sale.saleDate)} ·{" "}
                                {sale.sellerName ?? "Sem vendedor"}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(
                                sale.workStatus
                              )}`}
                            >
                              {WORK_STATUS_LABELS[sale.workStatus] ??
                                sale.workStatus}
                            </span>
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
                            <div className="min-w-0 text-xs text-[var(--muted-foreground)]">
                              <p className="truncate">
                                Snapshot: {sale.clientName}
                              </p>
                              <p>{formatPhone(sale.clientPhone)}</p>
                            </div>
                            <p className="shrink-0 font-semibold text-[var(--foreground)]">
                              {formatCurrency(sale.amount)}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function duplicateCriterion(group: DuplicateGroup) {
  if (group.criterion === "phone_and_name_birth_date") {
    return "Mesmo telefone, nome e nascimento";
  }
  if (group.criterion === "phone") return "Mesmo telefone normalizado";
  return "Mesmo nome normalizado e nascimento";
}

export default function AdminCadastros() {
  const [activeTab, setActiveTab] = useState<CadastrosTab>("clientes");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim(), 350);
  const [page, setPage] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const listInput = useMemo(
    () => ({
      query: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, page]
  );

  const clientListQuery = trpc.clients.adminList.useQuery(listInput, {
    staleTime: 30_000,
    placeholderData: previousData => previousData,
  });
  const duplicateGroupsQuery = trpc.clients.duplicateGroups.useQuery(
    undefined,
    {
      enabled: activeTab === "duplicidades",
      staleTime: 60_000,
    }
  );

  const clients = clientListQuery.data?.items ?? [];
  const totalClients = clientListQuery.data?.total ?? 0;
  const totalPages = Math.max(clientListQuery.data?.totalPages ?? 1, 1);
  const duplicateGroups = duplicateGroupsQuery.data ?? [];

  const openEdit = (client: ClientRecord) => {
    setSelectedClientId(null);
    setEditingClient(client);
    setEditOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
        <FadeIn>
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <ContactRound className="h-5 w-5" />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold text-[var(--foreground)]"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Cadastros
                </h1>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Clientes, histórico e revisão segura de possíveis duplicidades
                </p>
              </div>
            </div>
            <div className="flex max-w-xl items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              <p>
                Área exclusiva do ADM. Edições ficam registradas e não alteram
                vendas antigas.
              </p>
            </div>
          </header>
        </FadeIn>

        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as CadastrosTab)}
          className="gap-5"
        >
          <TabsList className="h-11 w-full border border-[var(--border)] bg-[var(--secondary)] p-1 sm:w-fit">
            <TabsTrigger value="clientes" className="h-9 px-4">
              <UsersRound className="h-4 w-4" />
              Clientes
              {clientListQuery.data && (
                <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                  {totalClients}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="duplicidades" className="h-9 px-4">
              <AlertCircle className="h-4 w-4" />
              Duplicidades
              {duplicateGroupsQuery.data && (
                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  {duplicateGroups.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="mt-0 space-y-4">
            <section
              aria-labelledby="clients-list-title"
              className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
            >
              <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2
                    id="clients-list-title"
                    className="font-semibold text-[var(--foreground)]"
                  >
                    Clientes cadastradas
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Pesquise por nome ou telefone. A consulta é paginada no
                    servidor.
                  </p>
                </div>
                <div className="w-full lg:max-w-md">
                  <label htmlFor="client-search" className="sr-only">
                    Buscar cliente por nome ou telefone
                  </label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <input
                      id="client-search"
                      type="search"
                      value={searchQuery}
                      onChange={event => {
                        setSearchQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Nome ou telefone"
                      autoComplete="off"
                      className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-20 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      {clientListQuery.isFetching && (
                        <Loader2
                          aria-label="Atualizando resultados"
                          className="h-4 w-4 animate-spin text-[var(--primary)]"
                        />
                      )}
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setPage(1);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                          aria-label="Limpar busca"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div aria-live="polite" className="sr-only">
                {clientListQuery.data
                  ? `${totalClients} cliente(s) encontrada(s)`
                  : "Carregando clientes"}
              </div>

              {clientListQuery.isLoading ? (
                <ClientListSkeleton />
              ) : clientListQuery.isError ? (
                <div className="p-5">
                  <ErrorState
                    message={clientListQuery.error.message}
                    onRetry={() => void clientListQuery.refetch()}
                  />
                </div>
              ) : clients.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <ContactRound className="mx-auto h-11 w-11 text-[var(--muted-foreground)]/40" />
                  <p className="mt-4 font-semibold text-[var(--foreground)]">
                    {debouncedSearch
                      ? "Nenhuma cliente encontrada"
                      : "Nenhuma cliente cadastrada"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {debouncedSearch
                      ? "Tente buscar com outro nome ou telefone."
                      : "Os cadastros aparecerão aqui após as vendas."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Lista paginada de clientes cadastradas
                      </caption>
                      <thead className="border-b border-[var(--border)] bg-[var(--secondary)]/40 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        <tr>
                          <th scope="col" className="px-5 py-3.5">
                            Cliente
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Telefone
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Nascimento
                          </th>
                          <th scope="col" className="px-5 py-3.5 text-center">
                            Vendas
                          </th>
                          <th scope="col" className="px-5 py-3.5">
                            Última venda
                          </th>
                          <th scope="col" className="px-5 py-3.5 text-right">
                            Total
                          </th>
                          <th scope="col" className="px-5 py-3.5 text-right">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {clients.map((client: ClientListItem) => (
                          <tr
                            key={client.id}
                            className="bg-[var(--card)] hover:bg-[var(--secondary)]/25"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => setSelectedClientId(client.id)}
                                className="text-left font-semibold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
                              >
                                {client.fullName}
                              </button>
                              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                ID {client.id}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4">
                              {formatPhone(client.phone)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4">
                              {formatDate(client.birthDate)}
                            </td>
                            <td className="px-5 py-4 text-center font-semibold">
                              {client.salesCount}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4">
                              {formatDate(client.lastSaleDate)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">
                              {formatCurrency(client.totalSpent)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedClientId(client.id)}
                                aria-label={`Abrir ficha de ${client.fullName}`}
                              >
                                <Eye className="h-4 w-4" />
                                Ver ficha
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-[var(--border)] md:hidden">
                    {clients.map((client: ClientListItem) => (
                      <article key={client.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-[var(--foreground)]">
                              {client.fullName}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              {formatPhone(client.phone)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                            {client.salesCount} venda
                            {client.salesCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-[var(--muted-foreground)]">
                              Nascimento
                            </dt>
                            <dd className="mt-1">
                              {formatDate(client.birthDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[var(--muted-foreground)]">
                              Última venda
                            </dt>
                            <dd className="mt-1">
                              {formatDate(client.lastSaleDate)}
                            </dd>
                          </div>
                          <div className="col-span-2 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
                            <div>
                              <dt className="text-xs text-[var(--muted-foreground)]">
                                Total registrado
                              </dt>
                              <dd className="mt-1 font-semibold">
                                {formatCurrency(client.totalSpent)}
                              </dd>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setSelectedClientId(client.id)}
                              aria-label={`Abrir ficha de ${client.fullName}`}
                            >
                              <Eye className="h-4 w-4" />
                              Ver ficha
                            </Button>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {clientListQuery.data && totalPages > 1 && (
                <nav
                  aria-label="Paginação de clientes"
                  className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-center text-sm text-[var(--muted-foreground)] sm:text-left">
                    Página {page} de {totalPages} · {totalClients} clientes
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={page <= 1 || clientListQuery.isFetching}
                      onClick={() =>
                        setPage(current => Math.max(1, current - 1))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        page >= totalPages || clientListQuery.isFetching
                      }
                      onClick={() =>
                        setPage(current => Math.min(totalPages, current + 1))
                      }
                    >
                      Próxima
                    </Button>
                  </div>
                </nav>
              )}
            </section>
          </TabsContent>

          <TabsContent value="duplicidades" className="mt-0 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  Revisão sem alterações automáticas
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Estes grupos são apenas indícios. Nada é mesclado, excluído ou
                  modificado nesta tela.
                </p>
              </div>
            </div>

            {duplicateGroupsQuery.isLoading ? (
              <div
                className="grid gap-4 xl:grid-cols-2"
                aria-label="Carregando possíveis duplicidades"
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-72 rounded-3xl" />
                ))}
              </div>
            ) : duplicateGroupsQuery.isError ? (
              <ErrorState
                message={duplicateGroupsQuery.error.message}
                onRetry={() => void duplicateGroupsQuery.refetch()}
              />
            ) : duplicateGroups.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
                <ShieldCheck className="mx-auto h-11 w-11 text-green-600/60" />
                <p className="mt-4 font-semibold text-[var(--foreground)]">
                  Nenhuma possível duplicidade encontrada
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Os cadastros atuais não formam grupos pelos critérios seguros.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {duplicateGroups.map(group => {
                  const confidence = Math.round(
                    group.score <= 1 ? group.score * 100 : group.score
                  );
                  return (
                    <article
                      key={group.id}
                      className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
                    >
                      <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Possível duplicidade
                          </p>
                          <h3 className="mt-1 font-semibold text-[var(--foreground)]">
                            {duplicateCriterion(group)}
                          </h3>
                        </div>
                        <span className="w-fit rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Confiança {confidence}%
                        </span>
                      </header>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {group.candidates.map(candidate => (
                          <div
                            key={candidate.id}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/25 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--foreground)]">
                                  {candidate.fullName}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                  ID {candidate.id}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setSelectedClientId(candidate.id)
                                }
                                aria-label={`Abrir ficha de ${candidate.fullName}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                            <dl className="mt-4 space-y-2 text-sm">
                              <div className="flex justify-between gap-3">
                                <dt className="text-[var(--muted-foreground)]">
                                  Telefone
                                </dt>
                                <dd className="text-right font-medium">
                                  {formatPhone(candidate.phone)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt className="text-[var(--muted-foreground)]">
                                  Nascimento
                                </dt>
                                <dd>{formatDate(candidate.birthDate)}</dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt className="text-[var(--muted-foreground)]">
                                  Vendas
                                </dt>
                                <dd className="font-semibold">
                                  {candidate.salesCount}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt className="text-[var(--muted-foreground)]">
                                  Última venda
                                </dt>
                                <dd>{formatDate(candidate.lastSaleDate)}</dd>
                              </div>
                              <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 text-xs">
                                <dt className="text-[var(--muted-foreground)]">
                                  Atualizado
                                </dt>
                                <dd>{formatDateTime(candidate.updatedAt)}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ClientDetailsDialog
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onEdit={openEdit}
        />
        <ClientEditDialog
          client={editingClient}
          open={editOpen}
          onOpenChange={open => {
            setEditOpen(open);
            if (!open) setEditingClient(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
