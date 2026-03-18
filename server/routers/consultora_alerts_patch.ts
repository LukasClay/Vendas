// PATCH: adicionar endpoint alerts ao consultora router
// Este arquivo é apenas referência — o conteúdo será inserido via shell
export const alertsEndpoint = `
  // ─── Aba Alertas: trabalhos urgentes e atrasados (Para Escrever + Pendentes) ─
  alerts: consultoraProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await (db.select({
      id: sales.id,
      clientName: sales.clientName,
      clientPhone: sales.clientPhone,
      productName: sales.productName,
      productCategory: sales.productCategory,
      saleDate: sales.saleDate,
      workStatus: sales.workStatus,
      sellerName: sales.sellerName,
    }).from(sales) as any)
      .where(
        and(
          or(eq(sales.workStatus, "para_escrever"), eq(sales.workStatus, "pendente")),
          ne(sales.productName, "Consulta Cartas")
        )
      )
      .orderBy(asc(sales.saleDate));

    const withUrgency = rows.map((s: any) => {
      const saleDateStr = s.saleDate instanceof Date ? s.saleDate.toISOString().split('T')[0] : String(s.saleDate);
      const urgency = calcBusinessDaysFromSale(saleDateStr);
      return {
        id: s.id,
        clientName: s.clientName,
        clientPhone: s.clientPhone,
        productName: s.productName,
        productCategory: s.productCategory ?? "individual",
        saleDate: s.saleDate,
        workStatus: s.workStatus as "para_escrever" | "pendente",
        sellerName: s.sellerName,
        daysRemaining: urgency.daysRemaining,
        deadline: urgency.deadline,
        isOverdue: urgency.isOverdue,
        isUrgent: urgency.isUrgent,
        urgencyScore: urgency.urgencyScore,
      };
    });

    // Retornar apenas urgentes e atrasados, ordenados por urgência
    return withUrgency
      .filter((item: any) => item.isOverdue || item.isUrgent)
      .sort((a: any, b: any) => b.urgencyScore - a.urgencyScore);
  }),
`;
