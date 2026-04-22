# Dívida Técnica — Mundo Da Magia LTDA

> Registro de decisões técnicas adiadas que não bloqueiam funcionalidade, mas
> devem ser conhecidas antes de novas mudanças relacionadas. Atualize quando
> uma dívida for resolvida ou uma nova for identificada.

**Priorização:** itens marcados **[ALTA]** têm ROI claro de qualidade de
código e devem ser endereçados nas próximas iterações. **[MÉDIA]** e
**[BAIXA]** ficam no radar até que uma mudança relacionada as torne
relevantes.

---

## 1. [ALTA] `(query as any)` em helpers do servidor apaga tipos de queries Drizzle

**Status:** Ativo — é o que bloqueia o benefício pleno do refactor de
`RouterOutputs` no cliente (ver histórico no fim).

**Onde está o código:**

- `server/db.ts:getSales`, `getTopSellers`, `getTopClients`,
  `getTopProducts`.
- `server/routers/consultora.ts` — queries `toWrite`, `pending`, `done`,
  `worksSummary`, `alerts`.

**Situação atual:** Cada função constrói um query builder Drizzle e
aplica `(query as any).where(...)` para conseguir adicionar `where`
condicionalmente depois de `.orderBy()` / `.from()`. O cast apaga o
tipo inferido — e cascateia até o cliente, de modo que vários
`RouterOutputs[...]` ainda resolvem para `any[]`:

- `RouterOutputs["sales"]["list"]`
- `RouterOutputs["reports"]["exportData"]`
- `RouterOutputs["reports"]["topSellers"|"topClients"|"topProducts"]`
- `RouterOutputs["consultora"]["toWrite"|"pending"|"done"|"worksSummary"|"alerts"]`

O refactor M2 (já mergeado) estabeleceu a rede de tipos, mas o
benefício real de detectar typos em `item.xxx` só aparece depois que
esses `as any` no servidor forem removidos.

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

- Classe de bug real, não hipotética (ver §2 — bug já identificado em
  `sales.exportCsv` que só está mascarado por causa destes casts).
- Cada novo endpoint criado sem tratar isso aumenta a superfície de
  lies do tipo cliente↔servidor.
- A refatoração é localizada e low-risk (não muda SQL, só ordem de
  chain no builder).

**Solução recomendada:**

1. Reestruturar o chain para aplicar `where` antes de `orderBy`:

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

2. Rodar `pnpm run typecheck` depois de cada helper ajustado — deve
   estourar em consumidores lendo campos errados (ver §2). Corrigir
   caso a caso.

3. Repetir para cada função listada acima. Não precisa ser feito num
   único commit — `getSales` primeiro é o de maior impacto.

**Risco de regressão:** Baixo. Drizzle emite o mesmo SQL (mesmos
`WHERE / ORDER BY / LIMIT / OFFSET`), só muda a ordem em que os
métodos encadeados constroem a query.

**Identificada em:** auditoria final da branch
`claude/refactor-trpc-router-outputs-wfIAp` (abril/2026).

---

## 2. [ALTA] `sales.exportCsv` lê campos no nível errado do retorno de `getSales`

**Status:** Ativo — bug latente mascarado por §1.

**Onde está o código:** `server/routers/sales.ts:654-672` (dentro do
handler `exportCsv`).

**Situação atual:** `getSales` retorna `{ sale, seller }[]`, mas o
`exportCsv` acessa campos no topo de `r`:

```ts
const rows = await getSales({ ... });   // retorna { sale, seller }[]
// ...
rows.map((r: (typeof rows)[number]) => [
  r.id,              // ❌ deveria ser r.sale.id
  r.saleDate,        // ❌ deveria ser r.sale.saleDate
  r.clientName,      // ❌ idem
  r.clientBirthDate, // ❌
  r.clientPhone,     // ❌
  r.productName,     // ❌
  r.productCategory, // ❌
  r.sellerName,      // ❌
  Number(r.amount),  // ❌ deveria ser r.sale.amount
  r.workStatus,      // ❌
  r.notes,           // ❌
]);
```

Hoje compila porque `getSales` retorna `any[]` (§1). Em runtime, esses
campos vêm `undefined`. Significa que **o CSV exportado pelo ADM
provavelmente está todo em branco nas colunas de dados** — precisa
verificar com o dono se alguém usa essa exportação (tem `exportXlsx`
e `exportPDF` em `admin/Vendas.tsx` e `admin/Relatorios.tsx` que
acessam corretamente via `item.sale ?? item`, então o CSV pode estar
quebrado e ninguém notou).

**Solução recomendada:**

1. Antes de resolver §1, verificar com o dono se esse CSV é
   realmente usado (endpoint `sales.exportCsv`).
2. Ao resolver §1 (remover `as any` de `getSales`), o TypeScript vai
   recusar o build apontando exatamente estas linhas. Arrumar para
   `r.sale.xxx` (e `r.seller?.name` onde couber).
3. Adicionar teste de snapshot do CSV para não regredir.

**Risco de regressão:** Nulo se hoje o CSV já vem vazio. Alto (no bom
sentido — vai passar a funcionar) se alguém usa esse endpoint.

**Identificada em:** auditoria final da branch
`claude/refactor-trpc-router-outputs-wfIAp` (abril/2026).

---

## 3. [MÉDIA] `(alertItems as any[])` e companhia em `Consultora.tsx`

**Status:** Ativo — não tocado no refactor M2 por restrição do
`TODO.md §1` (painel Consultora é intocável para mudanças
visuais/funcionais).

**Onde está o código:** `client/src/pages/Consultora.tsx` —
múltiplos locais:

- `activeItems as any[]` (linhas ~1345, 1564)
- `categoryFilteredItems as any[]` (~1350, 1352)
- `alertItems as any[]` (~1441, 1748, 1759, 1775, 1781)
- `(history as any).totalConsultas` / `(history as any).consultas`
  (~531, 547, 548, 552, 1020, 1036, 1037, 1041)
- `(item: any)` dentro do `alertItems.map` (1781)

**Situação atual:** Mesmo com `RouterOutputs` exposto, os casts
pré-existentes sobrevivem em Consultora porque:

- Removê-los é mudança type-only, porém em painel crítico — qualquer
  novo erro de TS precisaria ser tratado, o que pode exigir pequena
  lógica adicional (guards, narrowing). No M2 preferi não arriscar.
- Vários dos alvos (`alerts`, `toWrite`, etc.) hoje resolvem para
  `any` mesmo via `RouterOutputs` (§1) — então tirar o `as any[]`
  literal sem resolver §1 troca seis por meia dúzia.

**Por que [MÉDIA]:** sem impacto funcional ou de performance. A
correção certa depende de §1 primeiro para valer a pena.

**Solução recomendada:**

1. Resolver §1 primeiro (assim `RouterOutputs["consultora"]["alerts"]`
   etc. viram tipos reais).
2. Depois, em PR dedicado para `Consultora.tsx`, substituir cada
   `xxx as any[]` por anotação com `RouterOutputs[...]`. Como é só
   type-only, passa pela restrição de painel intocável.
3. Validar visual em 375px e funcionamento das abas (TODO.md §99).

**Identificada em:** auditoria final da branch
`claude/refactor-trpc-router-outputs-wfIAp` (abril/2026).

---

## 4. [BAIXA] `onError: (err: any)` e `catch (err: any)` espalhados por admin/

**Status:** Ativo — não é regressão, é padrão legado.

**Onde está o código:** vários arquivos em `client/src/pages/admin/`
(Consultas, Lixeira, Trabalhos) — ~15 ocorrências de
`onError: (err: any) => toast.error(err.message)` e uma
`catch (err: any)` em `admin/Consultas.tsx:517`.

**Situação atual:** Toda mutação tRPC declara error handler com `any`
para poder ler `.message`. Sem tipo, um handler que tentasse ler
`.statusCode` compilaria silenciosamente mesmo que o tipo real não
tenha esse campo.

**Por que [BAIXA]:** erro raramente traz surpresa — a API tRPC emite
sempre `TRPCClientError` com `.message`. Risco prático é baixo.

**Solução recomendada (quando endereçar):**

- Trocar `(err: any)` por `(err: Error)` ou melhor ainda importar
  `TRPCClientError` de `@trpc/client` e usar como tipo.
- Alternativamente criar helper `showError(err: unknown)` com
  narrowing interno para `.message`, eliminando a assinatura `any`
  em todos os sites de uma vez.

**Identificada em:** auditoria final da branch
`claude/refactor-trpc-router-outputs-wfIAp` (abril/2026).

---

## 5. [BAIXA] Cache do Service Worker sem estratégia de cache-busting de app shell

**Status:** Não é risco no estado atual (abril/2026).

**Onde está o código:** `client/public/sw.js`

**Situação atual:** O Service Worker implementa apenas handlers de
push notification (`push`, `notificationclick`). Não há `CACHE_NAME`,
`workbox`, `VitePWA` nem precaching de HTML/JS/CSS. Os assets do Vite
já têm hash no nome, então o navegador busca o bundle novo a cada
deploy automaticamente.

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
3. Chamar `self.skipWaiting()` no `install` e `clients.claim()` no
   `activate` para forçar ativação imediata do novo SW.
4. Registrar o SW no cliente com
   `navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })`.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

---

## 6. [MÉDIA] Vendas legadas com `productCategory` mal-classificado

**Status:** Impacto visual residual, volume provavelmente pequeno.

**Onde está o código:** `shared/businessDays.ts:getSaleUrgency`,
`drizzle/schema.ts:sales.productCategory`

**Situação atual:** A coluna `sales.productCategory` tem
`DEFAULT 'individual'` no schema
(`drizzle/0000_watery_fat_cobra.sql:71`). Vendas criadas antes de o
sistema distinguir coletivos, ou vendas criadas por erro de
categorização humana, podem ter `productCategory = 'individual'`
quando na realidade são trabalhos coletivos. Essas vendas continuarão
recebendo prazo automático de 7 dias úteis e aparecendo como vencidas
/ urgentes mesmo após o fix de coletivos.

> **Atenção ao escopo:** coletivos **corretamente** classificados
> (`productCategory = 'coletivo'`) já são tratados retroativamente
> pelo fix de `getSaleUrgency` — não aparecem mais como vencidos.
> Esta dívida cobre apenas vendas **mal-classificadas**
> historicamente.

**Por que não foi migrado no PR que introduziu o fix:** Não há como
um fix de código adivinhar quais vendas antigas foram
mal-categorizadas. Requer revisão humana caso-a-caso.

**Estratégia recomendada: corrigir caso-a-caso, a partir de agora.**

- **Para identificar candidatos:** listar vendas ativas com prazo
  antigo que o dono/consultora reconheça como coletivo. SQL de
  diagnóstico:

  ```sql
  SELECT id, "dateOfSale", "productCategory", "customerName", "productDescription", "workStatus"
  FROM sales
  WHERE "productCategory" = 'individual'
    AND "workStatus" IN ('para_escrever', 'pendente')
    AND "deletedAt" IS NULL
    AND "dateOfSale" < NOW() - INTERVAL '30 days'
  ORDER BY "dateOfSale" DESC;
  ```

  (ajuste o intervalo conforme o horizonte que fizer sentido; 30 dias
  é um ponto de partida razoável.)

- **Para corrigir:** editar a venda pelo painel ADM
  (`/admin` → Vendas → editar venda → trocar `productCategory`) — a
  UI existente já permite alterar a categoria de vendas existentes.

- **Não é necessária migração automática:** o impacto é apenas visual
  (aparece prazo onde não deveria). Dados financeiros, fluxo de
  entrega e cálculos de comissão permanecem corretos
  independentemente da categoria.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

---

## Histórico de dívidas resolvidas

- **M2 · RouterOutputs no cliente (abril/2026)** — resolvida na branch
  `claude/refactor-trpc-router-outputs-wfIAp`.
  `client/src/lib/trpc.ts` expõe
  `export type RouterOutputs = inferRouterOutputs<AppRouter>`;
  consumidores ADM (Trabalhos, Dashboard, Vendas, Lixeira,
  Relatórios, Alertas) e os PropTypes dos cards em Consultora tipam
  props e callbacks via `RouterOutputs`. Interface local `WorkItem` em
  `Dashboard.tsx` removida. Chunk `trpc-query-*.js` com hash idêntica
  antes/depois (83.21 kB) — `inferRouterOutputs` é type-only.
  Benefício pleno está bloqueado por §1 até que os casts do servidor
  saiam.
