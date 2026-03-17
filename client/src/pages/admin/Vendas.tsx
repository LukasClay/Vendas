import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { FileText, ExternalLink, Filter, X, Pencil, Trash2, Check, History, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

function toInputDate(date: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export default function AdminVendas() {
  const utils = trpc.useUtils();
  const { data: sellers = [] } = trpc.users.listAll.useQuery();
  const { data: products = [] } = trpc.products.listAll.useQuery();

  const [filters, setFilters] = useState({ startDate: "", endDate: "", sellerId: "", productName: "" });
  const queryFilters = useMemo(() => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sellerId: filters.sellerId ? Number(filters.sellerId) : undefined,
    productName: filters.productName || undefined,
    limit: 200,
  }), [filters]);

  const { data: salesData = [], isLoading } = trpc.sales.list.useQuery(queryFilters);

  // Estado do modal de edição
  const [editSale, setEditSale] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    clientName: "", clientBirthDate: "", clientPhone: "",
    productName: "", saleDate: "", amount: "", notes: "", sellerId: "",
  });

  // Estado de confirmação de exclusão
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Estado do modal de histórico de cliente
  const [historyClientName, setHistoryClientName] = useState<string | null>(null);
  const { data: clientHistory, isLoading: loadingHistory } = trpc.sales.clientHistory.useQuery(
    { clientName: historyClientName! },
    { enabled: !!historyClientName }
  );

  const updateSale = trpc.sales.update.useMutation({
    onSuccess: () => {
      toast.success("Venda atualizada com sucesso!");
      utils.sales.list.invalidate();
      setEditSale(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSale = trpc.sales.delete.useMutation({
    onSuccess: () => {
      toast.success("Venda excluída com sucesso!");
      utils.sales.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (item: any) => {
    const sale = item.sale ?? item;
    setEditSale(sale);
    setEditForm({
      clientName: sale.clientName ?? "",
      clientBirthDate: toInputDate(sale.clientBirthDate),
      clientPhone: sale.clientPhone ?? "",
      productName: sale.productName ?? "",
      saleDate: toInputDate(sale.saleDate),
      amount: sale.amount ? String(Number(sale.amount)) : "",
      notes: sale.notes ?? "",
      sellerId: sale.sellerId ? String(sale.sellerId) : "",
    });
  };

  const handleUpdate = () => {
    if (!editSale) return;
    updateSale.mutate({
      id: editSale.id,
      clientName: editForm.clientName || undefined,
      clientBirthDate: editForm.clientBirthDate || undefined,
      clientPhone: editForm.clientPhone || undefined,
      productName: editForm.productName || undefined,
      saleDate: editForm.saleDate || undefined,
      amount: editForm.amount ? Number(editForm.amount) : undefined,
      notes: editForm.notes || undefined,
      sellerId: editForm.sellerId ? Number(editForm.sellerId) : undefined,
    });
  };

  const totalAmount = salesData.reduce((acc: number, item: any) => {
    const sale = item.sale ?? item;
    return acc + Number(sale.amount);
  }, 0);

  const hasFilters = filters.startDate || filters.endDate || filters.sellerId || filters.productName;
  const clearFilters = () => setFilters({ startDate: "", endDate: "", sellerId: "", productName: "" });

  const inputStyle = {
    border: "1.5px solid oklch(0.88 0.012 65)",
    background: "oklch(0.97 0.005 260)",
    color: "oklch(0.15 0.02 260)",
    fontSize: "16px",
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Todas as Vendas
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
            {salesData.length} venda{salesData.length !== 1 ? "s" : ""} encontrada{salesData.length !== 1 ? "s" : ""}
            {totalAmount > 0 && ` · Total: ${formatCurrency(totalAmount)}`}
          </p>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>Filtros</h2>
            {hasFilters && (
              <button onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Data início</label>
              <input type="date" value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Data fim</label>
              <input type="date" value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Vendedor</label>
              <select value={filters.sellerId}
                onChange={e => setFilters(f => ({ ...f, sellerId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>
                <option value="">Todos</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.displayName || s.name || s.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Trabalho</label>
              <select value={filters.productName}
                onChange={e => setFilters(f => ({ ...f, productName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer" style={inputStyle}>
                <option value="">Todos</option>
                {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        {/* Modal de Histórico de Cliente */}
        {historyClientName && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setHistoryClientName(null); }}>
            <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
              style={{ background: "white" }}>
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
                <div>
                  <h2 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
                    Histórico da Cliente
                  </h2>
                  <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>{historyClientName}</p>
                </div>
                <button onClick={() => setHistoryClientName(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: "oklch(0.52 0.015 260)" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5">
                {loadingHistory ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.60 0.13 65)" }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Trabalhos */}
                    {clientHistory && clientHistory.totalPurchases > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "oklch(0.52 0.015 260)" }}>
                          Trabalhos ({clientHistory.totalPurchases})
                        </h3>
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.88 0.012 65)" }}>
                          {clientHistory.purchases.map((p: any, i: number) => (
                            <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-2"
                              style={{ borderBottom: i < clientHistory.purchases.length - 1 ? "1px solid oklch(0.93 0.008 65)" : "none" }}>
                              <div>
                                <p className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{p.productName}</p>
                                <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{formatDate(p.saleDate)}</p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                                background: p.workStatus === "feito" ? "oklch(0.92 0.04 160)" : p.workStatus === "pendente" ? "oklch(0.94 0.03 65)" : "oklch(0.92 0.04 250)",
                                color: p.workStatus === "feito" ? "oklch(0.40 0.14 160)" : p.workStatus === "pendente" ? "oklch(0.45 0.10 65)" : "oklch(0.40 0.14 250)",
                              }}>
                                {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Consultas */}
                    {clientHistory && clientHistory.totalConsultas > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "oklch(0.52 0.015 260)" }}>
                          Consultas de Cartas ({clientHistory.totalConsultas})
                        </h3>
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.88 0.015 280)" }}>
                          {clientHistory.consultas.map((c: any, i: number) => (
                            <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-2"
                              style={{ borderBottom: i < clientHistory.consultas.length - 1 ? "1px solid oklch(0.92 0.01 280)" : "none" }}>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.50 0.14 280)" }} />
                                <p className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>Consulta Cartas</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.40 0.14 280)" }}>
                                  {c.consultationDate ? c.consultationDate.slice(8,10)+"/"+c.consultationDate.slice(5,7)+"/"+c.consultationDate.slice(0,4) : ""} às {c.consultationTime}
                                </span>
                                {c.status === "cancelada" && (
                                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.18 25)" }}>Cancelada</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {clientHistory && clientHistory.totalPurchases === 0 && clientHistory.totalConsultas === 0 && (
                      <p className="text-sm text-center py-6" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum histórico encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "oklch(0.60 0.13 65)", borderTopColor: "transparent" }} />
            </div>
          ) : salesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileText className="w-10 h-10 mb-3" style={{ color: "oklch(0.75 0.06 65)" }} />
              <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhuma venda encontrada</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs mt-2 underline" style={{ color: "oklch(0.60 0.13 65)" }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(0.88 0.012 65)" }}>
                      {["Data", "Cliente", "Trabalho", "Vendedor", "Valor", "Comprovante", "Ações"].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.52 0.015 260)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item: any) => {
                      const sale = item.sale ?? item;
                      const seller = item.seller;
                      return (
                        <tr key={sale.id} className="transition-colors"
                          style={{ borderBottom: "1px solid oklch(0.94 0.006 65)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td className="px-4 py-3.5 text-sm whitespace-nowrap" style={{ color: "oklch(0.52 0.015 260)" }}>
                            {formatDate(sale.saleDate)}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => setHistoryClientName(sale.clientName)}
                              className="text-left hover:underline"
                              title="Ver histórico desta cliente">
                              <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.15 250)" }}>{sale.clientName}</p>
                            </button>
                            {sale.clientPhone && <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{sale.clientPhone}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-sm" style={{ color: "oklch(0.30 0.02 260)" }}>{sale.productName}</td>
                          <td className="px-4 py-3.5 text-sm" style={{ color: "oklch(0.30 0.02 260)" }}>
                            {seller?.displayName || seller?.name || "-"}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: "oklch(0.45 0.12 65)" }}>
                            {formatCurrency(sale.amount)}
                          </td>
                          <td className="px-4 py-3.5">
                            {sale.attachmentUrl ? (
                              <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg w-fit"
                                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                                <ExternalLink className="w-3 h-3" /> Ver
                              </a>
                            ) : (
                              <span className="text-xs" style={{ color: "oklch(0.70 0.01 260)" }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              {/* Editar */}
                              <button onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg transition-colors hover:bg-blue-50"
                                style={{ color: "oklch(0.50 0.18 250)" }} title="Editar venda">
                                <Pencil className="w-4 h-4" />
                              </button>
                              {/* Excluir / Confirmar */}
                              {deleteConfirmId === sale.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteSale.mutate({ id: sale.id })}
                                    disabled={deleteSale.isPending}
                                    className="p-1.5 rounded-lg text-white transition-colors text-xs font-semibold px-2"
                                    style={{ background: "oklch(0.58 0.22 25)" }}
                                    title="Confirmar exclusão">
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setDeleteConfirmId(null)}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                                    style={{ color: "oklch(0.52 0.015 260)" }} title="Cancelar">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirmId(sale.id)}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                                  style={{ color: "oklch(0.58 0.22 25)" }} title="Excluir venda">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                {salesData.map((item: any) => {
                  const sale = item.sale ?? item;
                  const seller = item.seller;
                  return (
                    <div key={sale.id} className="px-4 py-4">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{sale.clientName}</p>
                        <p className="font-semibold text-sm" style={{ color: "oklch(0.45 0.12 65)" }}>{formatCurrency(sale.amount)}</p>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "oklch(0.52 0.015 260)" }}>
                        {sale.productName} · {seller?.displayName || seller?.name || ""} · {formatDate(sale.saleDate)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setHistoryClientName(sale.clientName)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.35 0.15 280)" }}>
                          <History className="w-3 h-3" /> Histórico
                        </button>
                        {sale.attachmentUrl && (
                          <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                            <ExternalLink className="w-3 h-3" /> Comprovante
                          </a>
                        )}
                        <button onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }}>
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        {deleteConfirmId === sale.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteSale.mutate({ id: sale.id })}
                              disabled={deleteSale.isPending}
                              className="text-xs px-2 py-1 rounded-lg text-white font-semibold"
                              style={{ background: "oklch(0.58 0.22 25)" }}>
                              Confirmar
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="text-xs px-2 py-1 rounded-lg"
                              style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(sale.id)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{ background: "oklch(0.95 0.04 25)", color: "oklch(0.58 0.22 25)" }}>
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      {editSale && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditSale(null); }}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[95vh] sm:max-h-[90vh]"
            style={{ background: "white" }}>
            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "oklch(0.88 0.012 65)" }}>
              <h2 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
                Editar Venda
              </h2>
              <button onClick={() => setEditSale(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: "oklch(0.52 0.015 260)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário */}
            <div className="px-4 sm:px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Nome do cliente
                  </label>
                  <input type="text" value={editForm.clientName}
                    onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Data de nascimento
                  </label>
                  <input type="date" value={editForm.clientBirthDate}
                    onChange={e => setEditForm(f => ({ ...f, clientBirthDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Telefone
                  </label>
                  <input type="tel" value={editForm.clientPhone}
                    onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Nome do trabalho
                  </label>
                  <input type="text" value={editForm.productName}
                    onChange={e => setEditForm(f => ({ ...f, productName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Data da venda
                  </label>
                  <input type="date" value={editForm.saleDate}
                    onChange={e => setEditForm(f => ({ ...f, saleDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Valor (R$)
                  </label>
                  <input type="number" step="0.01" min="0" value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Vendedor
                  </label>
                  <select value={editForm.sellerId}
                    onChange={e => setEditForm(f => ({ ...f, sellerId: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none cursor-pointer" style={inputStyle}>
                    <option value="">Manter atual</option>
                    {sellers.map(s => (
                      <option key={s.id} value={s.id}>{s.displayName || s.name || s.email}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                    Observações
                  </label>
                  <textarea value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Observações opcionais..."
                    className="w-full px-4 py-3 rounded-xl outline-none resize-none" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Footer do modal */}
            <div className="flex gap-3 px-4 sm:px-6 py-4 border-t pb-6 sm:pb-4" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
              <button
                onClick={handleUpdate}
                disabled={updateSale.isPending}
                className="flex-1 py-4 sm:py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 active:scale-95"
                style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))", fontSize: "16px" }}>
                {updateSale.isPending ? "Salvando..." : "Salvar Alterações"}
              </button>
              <button onClick={() => setEditSale(null)}
                className="px-5 py-4 sm:py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)", fontSize: "16px" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
