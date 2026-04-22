# Dívida Técnica — Mundo Da Magia LTDA

> Registro de decisões técnicas adiadas que não bloqueiam funcionalidade, mas
> devem ser conhecidas antes de novas mudanças relacionadas. Atualize quando
> uma dívida for resolvida ou uma nova for identificada.

**Priorização:** itens marcados **[ALTA]** têm ROI claro de qualidade de
código e devem ser endereçados nas próximas iterações. **[MÉDIA]** e
**[BAIXA]** ficam no radar até que uma mudança relacionada as torne
relevantes.

---

**Sem dívidas ativas no momento** (abril/2026). Consulte o histórico
abaixo para contexto de refactors e fixes já aplicados.

---

## Histórico de dívidas resolvidas

- **Service Worker: `updateViaCache: 'none'` no register (abril/2026)**
  — aplicado em `client/src/hooks/usePushNotifications.ts`. Elimina
  a janela de até 24h em que o browser poderia servir um `sw.js`
  velho do HTTP cache. Como o projeto não faz precaching de app
  shell (sem `workbox`/`VitePWA` e sem `fetch` handler no SW), não
  há cache de HTML/JS/CSS para gerenciar — o fix de 1 linha fecha
  a única pegadinha real. Se no futuro for adicionado precaching
  (ex.: PWA offline), resolver na mesma PR:
  `CACHE_VERSION` + cleanup no `activate` + verificação de hash.

- **Vendas legadas com `productCategory` mal-classificado (abril/2026)**
  — triagem humana concluída pelo dono via painel ADM. Coletivos
  corretamente classificados já eram tratados pelo fix de
  `getSaleUrgency`; vendas mal-classificadas foram reclassificadas
  caso-a-caso. Sem mudança de código necessária.

- **M3 · Eliminar `(query as any)`, bugs latentes e `err: any`
  (abril/2026)** — resolvida na branch
  `claude/review-todo-docs-pAEH8`.

  Removidos todos os 8 casts `(query as any)` em `server/db.ts`
  (`getSales`, `getTopSellers`, `getTopClients`, `getTopProducts`,
  `getReportSummary`, `getReportSummaryByCompany`, `getAuditLogs`) e
  os 6 casts `.from(sales) as any` em `server/routers/consultora.ts`
  (`toWrite`, `pending`, `done`, `worksSummary` — duas ocorrências —
  e `alerts`, agora com type predicate explícito no `.filter` que
  curto-circuita itens sem prazo). Refactor reordena os chains para
  aplicar `.where()` antes de `.groupBy()/.orderBy()` sem alterar o
  SQL emitido.

  Ao tipar `RouterOutputs["sales"]["list"]`, o TypeScript passou a
  recusar o `sales.exportCsv` que lia `r.id/r.saleDate/...` no topo
  de `{ sale, seller }` (CSV sai vazio em runtime) — corrigido para
  `sale.xxx` e `seller?.name`. Outros bugs latentes mascarados
  também corrigidos:
  - `admin/Relatorios.tsx`: `key={seller.id}` → `key={seller.sellerId}`,
    `key={client.id}` → `key` composto por nome+telefone,
    `key={product.id}` → `key={product.productName}`, fallbacks
    mortos `|| seller.name`, `|| client.name`, `|| product.name`
    removidos, e `summary.averageSale` (sempre R$ 0,00) substituído
    por cálculo no cliente (`totalAmount / totalSales`).
  - `admin/Trabalhos.tsx`: `item.completedAt || item.doneAt` →
    `item.completedAt` (campo `doneAt` não existe).
  - `admin/Vendas.tsx`: `.filter(Boolean)` dentro de cast implícito
    substituído por type predicate para narrowing de `string | null`.

  `client/src/pages/Consultora.tsx` limpo de 19 casts `as any[]` /
  `as any` trocados por inferência direta via `RouterOutputs`
  (mudança puramente type-only — JSX, handlers e estado intocados,
  respeitando `TODO.md §1`). Uso de discriminated union
  (`hasDeadline`) em `admin/Trabalhos.tsx` e `admin/Dashboard.tsx`
  substitui os antigos `item.isOverdue ?? false` defensivos.

  Helper `showError(err: unknown)` + `errorMessage(err, fallback?)`
  criado em `client/src/lib/errors.ts` e usado em 9 sites de
  `admin/Consultas.tsx` e `admin/Lixeira.tsx` — zero `err: any`
  restante em `client/src/pages/`.

- **M2 · RouterOutputs no cliente (abril/2026)** — resolvida na branch
  `claude/refactor-trpc-router-outputs-wfIAp`.
  `client/src/lib/trpc.ts` expõe
  `export type RouterOutputs = inferRouterOutputs<AppRouter>`;
  consumidores ADM (Trabalhos, Dashboard, Vendas, Lixeira,
  Relatórios, Alertas) e os PropTypes dos cards em Consultora tipam
  props e callbacks via `RouterOutputs`. Interface local `WorkItem` em
  `Dashboard.tsx` removida. Chunk `trpc-query-*.js` com hash idêntica
  antes/depois (83.21 kB) — `inferRouterOutputs` é type-only. Plena
  utilidade estava bloqueada por §1 (agora resolvido no M3).
