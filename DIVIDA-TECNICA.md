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

**Status:** Ativo — **próximo refactor prioritário**.

**Onde está o código:** `client/src/pages/admin/Trabalhos.tsx`,
`client/src/pages/admin/Dashboard.tsx`, `client/src/pages/admin/Vendas.tsx`,
parcialmente em `client/src/pages/Consultora.tsx`.

**Situação atual:** Cards e linhas de tabela aceitam `item: any` /
`sale: any` / `work: any` como prop. O tipo de retorno dos endpoints
tRPC (`consultora.toWrite`, `consultora.pending`, `sales.list` etc.) é
perdido na passagem servidor → cliente → componente. Resultado:

- Refactors no servidor (renomear campo, mudar tipo, remover coluna)
  não quebram o build do cliente; quebras só aparecem em runtime.
- IDE não oferece autocomplete nem detecta typos em `item.fooBar`.
- Foi exatamente essa classe de bug que motivou a tipagem de
  `productCategory` na Fase 1 deste PR — `WorkItem` em `Dashboard.tsx`
  declarava `productCategory?: string | null`, divergindo do resto do
  app que usava `ProductCategory`. Sem tipo compartilhado, só checagem
  visual de PR pega esse desalinhamento.

**Por que é alta prioridade:**

- Classe de bug real, já observada no próprio código (não hipotética).
- Refactor isolado, ~1h de trabalho, zero mudança de comportamento.
- Cada novo endpoint/campo criado sem isso aumenta a dívida.

**Solução recomendada:**

1. Em `client/src/lib/trpc.ts`, adicionar:

   ```ts
   import type { inferRouterOutputs } from "@trpc/server";
   import type { AppRouter } from "../../../server/routers";

   export type RouterOutputs = inferRouterOutputs<AppRouter>;
   ```

2. Substituir `(item: any)` pelos tipos derivados nos principais
   consumidores:
   - `admin/Trabalhos.tsx` — `ToWriteCard`, `PendingCard`, `DoneCard`:
     usar `RouterOutputs["consultora"]["toWrite"][number]`,
     `RouterOutputs["consultora"]["pending"][number]` etc.
   - `admin/Dashboard.tsx` — remover a interface local `WorkItem`
     (linhas 40-49) e usar o tipo derivado de `worksSummary`.
   - `admin/Vendas.tsx` — ~7 usos de `(sale: any)`.
   - `Consultora.tsx` — PropTypes inline dos cards podem ser substituídos
     pelo tipo derivado.

3. Verificar que o bundle do cliente não infla significativamente
   (`inferRouterOutputs` é puramente type-level, zero runtime). Rodar
   `pnpm run build` e comparar tamanho do chunk `trpc-query` antes/depois.

**Risco de regressão:** Baixíssimo. A mudança é type-only — TypeScript
rejeitará qualquer divergência no build, não há mudança de comportamento.

**Prompt prontinho para rodar em sessão separada:**
`docs/prompts/m2-router-outputs.md`.

**Identificada em:** revisão da branch
`claude/evaluate-deadline-fix-branches-lEjYW` (abril/2026).

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
