# Dívida Técnica — Mundo Da Magia LTDA

> Registro de decisões técnicas adiadas que não bloqueiam funcionalidade, mas
> devem ser conhecidas antes de novas mudanças relacionadas. Atualize quando
> uma dívida for resolvida ou uma nova for identificada.

---

## 1. Cache do Service Worker sem estratégia de cache-busting de app shell

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

## 2. Vendas legadas com `productCategory` mal-classificado

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
