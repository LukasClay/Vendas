export function reserveConsultationSlotState(saleId: number) {
  return {
    sold: true,
    saleId,
    status: "pendente" as const,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    refundStatus: "none" as const,
    refundRequestedAt: null,
    refundRequestedBy: null,
    refundResolvedAt: null,
    refundResolvedBy: null,
  };
}

export function releaseConsultationSlotState() {
  return {
    sold: false,
    saleId: null,
    status: "pendente" as const,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    refundStatus: "none" as const,
    refundRequestedAt: null,
    refundRequestedBy: null,
    refundResolvedAt: null,
    refundResolvedBy: null,
  };
}

export function trashConsultationSlotState(
  cancelledBy: number | null,
  cancelledAt: Date
) {
  return {
    sold: true,
    status: "cancelada" as const,
    cancelledBy,
    cancelledAt,
    cancelReason: "Venda movida para a lixeira.",
    refundStatus: "none" as const,
    refundRequestedAt: null,
    refundRequestedBy: null,
    refundResolvedAt: null,
    refundResolvedBy: null,
  };
}
