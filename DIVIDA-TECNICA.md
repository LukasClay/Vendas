# Dívida Técnica — Mundo Da Magia LTDA

> Registro de decisões técnicas adiadas que não bloqueiam funcionalidade, mas
> devem ser conhecidas antes de novas mudanças relacionadas. Atualize quando
> uma dívida for resolvida ou uma nova for identificada.

**Priorização:** itens marcados **[ALTA]** têm ROI claro de qualidade de
código e devem ser endereçados nas próximas iterações. **[MÉDIA]** e
**[BAIXA]** ficam no radar até que uma mudança relacionada as torne
relevantes.

---

## 1. [ALTA] Client consome `(item: any)` em vez de `RouterOutputs` do tRPC

**Status:** ✅ Resolvida em abril/2026 na branch
`claude/refactor-trpc-router-outputs-wfIAp`.

`client/src/lib/trpc.ts` agora expõe
`export type RouterOutputs = inferRouterOutputs<AppRouter>` e os
consumidores listados (Trabalhos, Dashboard, Vendas, Lixeira, Relatórios,
Alertas, Consultora) tipam props e callbacks por `RouterOutputs`.
Interface local `WorkItem` em `Dashboard.tsx` removida. Build: chunk
`trpc-query-*.js` inalterado (83.21 kB antes/depois — `inferRouterOutputs`
é type-only). Verify (typecheck + format + 71 testes + build) verde.

**Follow-up identificado (nova dívida [ALTA] §4):** Vários helpers de
`server/db.ts` (ex.: `getSales`, `getTopSellers`, `getTopClients`,
`getTopProducts`) e queries em `server/routers/consultora.ts`
(`toWrite`, `pending`, `done`, `worksSummary`, `alerts`) usam
`(query as any)` para contornar tipagem condicional do builder do Drizzle.
Isso faz com que `RouterOutputs["sales"]["list"]`,
`RouterOutputs["consultora"]["toWrite"]` etc. resolvam para `any[]`
no cliente — a rede de tipos foi estabelecida pelo refactor, mas o
benefício real só aparece quando esses `as any` no servidor forem
eliminados reestruturando a ordem do chain (ex.: `.where()` antes de
`.orderBy()`). Ver §4.

---

## 2. [BAIXA] Cache do Service Worker sem estratégia de cache-busting de app shell

**Status:** Não é risco no estado atual (abril/2026).

**Onde está o código:** `client/public/sw.js`

**Situação atual:** O Service Worker implementa apenas handlers de push
notification (`push`, `notificationclick`). Não há `CACHE_NAME`, `workbox`,
`VitePWA` nem precaching de HTML/JS/CSS. Os assets do Vite já têm hash no
nome, então o navegador busca o bundle novo a cada deploy automaticamente.

**Quando vira problema:** Se no futuro alguém adicionar precaching de app
shell (ex.: adotar `VitePWA` ou `workbox` para modo offline), clientes com
Service Worker velho podem ficar presos em uma versão antiga da UI mesmo
após deploy. Bugs visuais ou de comportamento corrigidos no servidor não
chegariam ao usuário até ele limpar o cache do navegador manualmente.

**Solução recomendada quando acontecer:**

1. Definir constante `CACHE_VERSION` no `sw.js` e bumpar a cada release.
2. No evento `activate`, apagar caches cujo nome não bate com a versão
   atual: `caches.keys().then(keys => keys.filter(k => k !== CACHE_VERSION).forEach(caches.delete))`.
3. Chamar `self.skipWaiting()` no `install` e `clients.claim()` no
   `activate` para forçar ativação imediata do novo SW.
4. Registrar o SW no cliente com
   `navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })`.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

---

## 3. [MÉDIA] Vendas legadas com `productCategory` mal-classificado

**Status:** Impacto visual residual, volume provavelmente pequeno.

**Onde está o código:** `shared/businessDays.ts:getSaleUrgency`,
`drizzle/schema.ts:sales.productCategory`

**Situação atual:** A coluna `sales.productCategory` tem `DEFAULT 'individual'`
no schema (`drizzle/0000_watery_fat_cobra.sql:71`). Vendas criadas antes de
o sistema distinguir coletivos, ou vendas criadas por erro de categorização
humana, podem ter `productCategory = 'individual'` quando na realidade são
trabalhos coletivos. Essas vendas continuarão recebendo prazo automático de
7 dias úteis e aparecendo como vencidas/urgentes mesmo após o fix de
coletivos.

> **Atenção ao escopo:** coletivos **corretamente** classificados
> (`productCategory = 'coletivo'`) já são tratados retroativamente pelo fix
> de `getSaleUrgency` — não aparecem mais como vencidos. Esta dívida
> cobre apenas vendas **mal-classificadas** historicamente.

**Por que não foi migrado no PR que introduziu o fix:** Não há como um fix
de código adivinhar quais vendas antigas foram mal-categorizadas. Requer
revisão humana caso-a-caso.

**Estratégia recomendada: corrigir caso-a-caso, a partir de agora.**

- **Para identificar candidatos:** listar vendas ativas com prazo antigo
  que o dono/consultora reconheça como coletivo. SQL de diagnóstico:

  ```sql
  SELECT id, "dateOfSale", "productCategory", "customerName", "productDescription", "workStatus"
  FROM sales
  WHERE "productCategory" = 'individual'
    AND "workStatus" IN ('para_escrever', 'pendente')
    AND "deletedAt" IS NULL
    AND "dateOfSale" < NOW() - INTERVAL '30 days'
  ORDER BY "dateOfSale" DESC;
  ```

  (ajuste o intervalo conforme o horizonte que fizer sentido; 30 dias é um
  ponto de partida razoável.)

- **Para corrigir:** editar a venda pelo painel ADM
  (`/admin` → Vendas → editar venda → trocar `productCategory`) — a UI
  existente já permite alterar a categoria de vendas existentes.

- **Não é necessária migração automática:** o impacto é apenas visual
  (aparece prazo onde não deveria). Dados financeiros, fluxo de entrega e
  cálculos de comissão permanecem corretos independentemente da categoria.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

---

## 4. [ALTA] `(query as any)` em helpers do servidor apaga tipos de queries Drizzle

**Status:** Ativo — bloqueia o benefício pleno da dívida §1 resolvida.

**Onde está o código:**

- `server/db.ts:getSales`, `getTopSellers`, `getTopClients`,
  `getTopProducts`.
- `server/routers/consultora.ts` (`toWrite`, `pending`, `done`,
  `worksSummary`, `alerts`).

**Situação atual:** Cada função constrói um query builder Drizzle e
aplica `(query as any).where(...)` para permitir adicionar `where`
condicionalmente depois de `.orderBy()`/`.from()`. Como `as any`
propaga pela Promise de retorno, o tipo inferido vai para `any[]` —
e cascateia até `RouterOutputs["sales"]["list"]`,
`RouterOutputs["consultora"]["toWrite"]` etc. no cliente. Resultado: o
refactor que introduziu `RouterOutputs` no cliente (§1) tem a estrutura
correta, mas os tipos derivados ainda resolvem para `any`, então
TypeScript não detecta typos em campos vindos dessas rotas.

Exemplo em `getSales`:

```ts
const query = db
  .select({ sale: sales, seller: { ... } })
  .from(sales)
  .leftJoin(users, ...)
  .orderBy(desc(sales.saleDate), desc(sales.createdAt));

return (query as any)          // <-- apaga o tipo
  .where(and(...conditions))
  .limit(...)
  .offset(...);
```

**Por que é alta prioridade:**

- O refactor do cliente (§1) já expôs `RouterOutputs`; agora cada
  query sem `as any` passa a render type-safety de verdade no cliente.
- Sem isso, divergências servidor↔cliente ainda só aparecem em runtime.
- Pode ter escondido bugs reais — inspeção rápida achou que
  `sales.exportCsv` lê `r.amount` direto enquanto `getSales` retorna
  `{ sale: { amount }, seller: { ... } }[]` (precisaria ser
  `r.sale.amount`). Confirmar/corrigir ao tipar.

**Solução recomendada:**

1. Reestruturar a ordem do chain para construir `where` antes de
   `orderBy`:

   ```ts
   const base = db
     .select({ sale: sales, seller: { ... } })
     .from(sales)
     .leftJoin(users, ...);

   const filtered =
     conditions.length > 0 ? base.where(and(...conditions)) : base;

   return filtered
     .orderBy(desc(sales.saleDate), desc(sales.createdAt))
     .limit(filters.limit ?? 100)
     .offset(filters.offset ?? 0);
   ```

2. Rodar `pnpm run typecheck` — pode aparecer algum consumidor lendo
   campos errados (ex.: `r.amount` em vez de `r.sale.amount`). Corrigir
   caso a caso.

3. Repetir para cada helper que hoje faz `(query as any)`.

**Risco de regressão:** Baixo. A reestruturação não muda o SQL gerado
(Drizzle emite os mesmos `WHERE/ORDER BY/LIMIT`). O único risco real é
expor bugs latentes de leitura de campo — o que é o objetivo.

**Identificada em:** revisão da branch
`claude/refactor-trpc-router-outputs-wfIAp` (abril/2026), enquanto
resolvia §1.
