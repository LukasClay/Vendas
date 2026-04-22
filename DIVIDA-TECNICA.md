# Dívida Técnica — Mundo Da Magia LTDA

> Registro de decisões técnicas adiadas que não bloqueiam funcionalidade, mas
> devem ser conhecidas antes de novas mudanças relacionadas. Atualize quando
> uma dívida for resolvida ou uma nova for identificada.

**Priorização:** itens marcados **[ALTA]** têm ROI claro de qualidade de
código e devem ser endereçados nas próximas iterações. **[MÉDIA]** e
**[BAIXA]** ficam no radar até que uma mudança relacionada as torne
relevantes.

---

## 1. [BAIXA] Cache do Service Worker sem estratégia de cache-busting de app shell

**Status:** Não é risco no estado atual (abril/2026).

**Onde está o código:** `client/public/sw.js`

**Situação atual:** O Service Worker implementa handlers de push
notification (`push`, `notificationclick`) e handlers de lifecycle
(`install` com `self.skipWaiting()`, `activate` com `clients.claim()`).
Não há `CACHE_NAME`, `workbox`, `VitePWA` nem precaching de HTML/JS/CSS.
Os assets do Vite já têm hash no nome, então o navegador busca o
bundle novo a cada deploy automaticamente.

**Quando vira problema:** Se no futuro alguém adicionar precaching de
app shell (ex.: adotar `VitePWA` ou `workbox` para modo offline),
clientes com Service Worker velho podem ficar presos em uma versão
antiga da UI mesmo após deploy. Bugs visuais ou de comportamento
corrigidos no servidor não chegariam ao usuário até ele limpar o
cache do navegador manualmente.

**Solução recomendada quando acontecer:**

1. Definir constante `CACHE_VERSION` no `sw.js` e bumpar a cada
   release.
2. No evento `activate`, apagar caches cujo nome não bate com a
   versão atual: `caches.keys().then(keys => keys.filter(k => k !== CACHE_VERSION).forEach(caches.delete))`.
3. `self.skipWaiting()` no `install` e `clients.claim()` no `activate`
   já estão implementados — só falta o gerenciamento de cache por
   versão e o `updateViaCache: 'none'` no `register`.
4. Registrar o SW no cliente com
   `navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })`.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

---

## Histórico de dívidas resolvidas

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
