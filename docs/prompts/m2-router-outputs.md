# Prompt — Refactor M2: `RouterOutputs` do tRPC no cliente

> Prompt self-contained para abrir em sessão nova do Claude Code (Opus 4.7
> recomendado). Copie tudo abaixo da linha horizontal e cole como primeira
> mensagem da nova sessão. O agente não precisa de contexto deste chat.

---

## Contexto

Você está trabalhando no projeto **Mundo Da Magia LTDA** (repo
`LukasClay/Vendas`). É um SaaS de vendas/consultoria com frontend React +
Vite + tRPC e backend Node + tRPC + Drizzle + Postgres. Antes de qualquer
alteração, leia `TODO.md` (regras invioláveis — painéis Vendedora e
Consultora são intocáveis, foco é ADM) e `DIVIDA-TECNICA.md` §1 (o item
que você vai resolver).

## Tarefa

Substituir `any` dos consumidores de endpoints tRPC no cliente por tipos
derivados de `RouterOutputs`, eliminando classe inteira de bugs onde o
tipo do servidor diverge do tipo assumido pelo componente.

**Problema real que isso evita** (exemplo pescado na branch
`claude/evaluate-deadline-fix-branches-lEjYW`): `admin/Dashboard.tsx`
declarava uma interface local `WorkItem` com `productCategory?: string
| null`, enquanto o restante do app usava o tipo nomeado
`ProductCategory`. Sem tipo compartilhado derivado do servidor, nada
acusou a divergência — só revisão visual de PR pegou.

## Passo 1 — Expor `RouterOutputs`

Arquivo: `client/src/lib/trpc.ts` (hoje tem ~3 linhas, só declara
`trpc = createTRPCReact<AppRouter>()`).

Adicionar:

```ts
import type { inferRouterOutputs } from "@trpc/server";
// O tipo AppRouter já é importado de "../../../server/routers".

export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

**Atenção:** `inferRouterOutputs` é type-only; zero impacto no bundle
runtime. Confirmar via `pnpm run build` — o chunk `trpc-query-*.js` deve
ficar do mesmo tamanho (±100 bytes).

## Passo 2 — Substituir `any` nos principais consumidores

Use `RouterOutputs["<router>"]["<procedure>"]` para mutations, e
`RouterOutputs["<router>"]["<procedure>"][number]` quando o endpoint
retorna array.

Exemplos de mapeamento a aplicar:

| Arquivo / linha (aprox.)                                                   | Uso atual       | Substituir por                                                                                                                        |
| -------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/Trabalhos.tsx:243` (ToWriteCard prop)                               | `item: any`     | `item: RouterOutputs["consultora"]["toWrite"][number]`                                                                                |
| `admin/Trabalhos.tsx:453` (PendingCard prop)                               | `item: any`     | `item: RouterOutputs["consultora"]["pending"][number]`                                                                                |
| `admin/Dashboard.tsx:40-49` (interface `WorkItem`)                         | interface local | remover interface; usar `RouterOutputs["consultora"]["worksSummary"]["pending"][number]` (ou `["toWrite"][number]` conforme contexto) |
| `admin/Vendas.tsx:64` (prop `sale`)                                        | `sale: any`     | `sale: RouterOutputs["sales"]["list"][number]`                                                                                        |
| `admin/Vendas.tsx:272` (prop `sale`)                                       | idem            | idem                                                                                                                                  |
| `admin/Vendas.tsx:1406,1423,1484,1494,1558,1563` (callbacks `(item: any)`) | `any`           | tipo derivado de `sales.list`                                                                                                         |
| `Consultora.tsx:1699,1717,1733,1775` (cards das abas)                      | `(item: any)`   | **mesmo cuidado com Consultora** (ver §Restrições)                                                                                    |
| `admin/Lixeira.tsx:87,100,207`                                             | `(item: any)`   | tipo derivado do endpoint da lixeira                                                                                                  |
| `admin/Dashboard.tsx:937`                                                  | `(item: any)`   | tipo derivado de `sales.list` ou endpoint correspondente                                                                              |
| `admin/Relatorios.tsx:133,199`                                             | `(item: any)`   | tipo derivado do endpoint de relatório                                                                                                |

Antes de cada edição em `Consultora.tsx` ou nos painéis Vendedora, **leia
a restrição da próxima seção**.

## Restrições invioláveis

1. **`NovaVenda.tsx` é intocável** (TODO.md §14). Nem abrir.
2. **Painéis Consultora e Vendedor são intocáveis** para mudanças visuais
   ou funcionais (TODO.md §1). Mudança de **tipo TypeScript puro** em
   `Consultora.tsx` é aceitável (zero impacto em runtime/UX), mas
   qualquer alteração que toque JSX, CSS, handler ou comportamento deve
   ser **pulada** e reportada ao dono no fim. Na dúvida, não mexa.
3. **Não adicione `as any` novos**. Se um tipo derivado não encaixar, é
   sinal de que o endpoint servidor precisa ajuste — reporte no fim em
   vez de silenciar com cast.
4. **Zero mudança de comportamento**. Nenhum `useEffect`, `useState`,
   `useQuery`, handler ou branch lógico deve mudar. Só tipos.
5. **Não instale dependências**. `inferRouterOutputs` já vem com
   `@trpc/server`.

## Fluxo de execução

1. Criar branch nova: `refactor/client-router-outputs`.
2. Passo 1 acima (expor `RouterOutputs` em `trpc.ts`).
3. Rodar `pnpm run typecheck` para validar que a adição compila.
4. Trabalhar um arquivo de cada vez: substituir, rodar
   `pnpm run typecheck`, corrigir erros.
5. Ao final, rodar `pnpm run verify` (typecheck + format:check +
   test:backend + build) — tudo deve passar. Testes são 71 (mesma
   quantidade de antes, o refactor não adiciona nem remove casos).
6. Commitar em uma ou mais etapas temáticas (ex.: um commit por arquivo
   grande como `Vendas.tsx`, ou agrupar os pequenos). Mensagens no padrão
   `refactor(types): <escopo> usar RouterOutputs do tRPC`.
7. Pushar e abrir PR com título
   `refactor(types): substituir any por RouterOutputs do tRPC`. Corpo
   descreve o ganho de type-safety e lista os arquivos tocados.

## Critério de sucesso

- `grep -rn "item: any\|sale: any\|work: any" client/src/` reduz
  drasticamente (mantendo apenas casos em que um tipo derivado realmente
  não existe, justificados em comentário).
- `pnpm run verify` verde.
- Zero mudança funcional visível ao usuário em qualquer painel.
- Build size do chunk `trpc-query-*.js` inalterado (±100 bytes).

## Entregáveis

1. Branch `refactor/client-router-outputs` pushada.
2. PR aberto (use `mcp__github__create_pull_request`).
3. Marcar §1 de `DIVIDA-TECNICA.md` como resolvida no próprio PR (mover
   para uma seção "Resolvidas" ou remover, a critério — manter o arquivo
   como log vivo).

## Se algo der errado

- `inferRouterOutputs` falhando em alguma rota → provavelmente o router
  ainda usa `any` no servidor. Investigar; não silenciar.
- Build size disparou → possível import runtime acidental; garantir que
  todo uso de `RouterOutputs` está em `type` position (ex.:
  `import type { RouterOutputs }` ou dentro de anotações de tipo).
- Consultora.tsx ou algum arquivo do painel Vendedora exigindo mudança
  além de tipos → pular esse arquivo, seguir com os outros, reportar ao
  dono no PR.
