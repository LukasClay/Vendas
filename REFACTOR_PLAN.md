# PLANO 1: REFACTOR_PLAN.md
## Plano de Execução: Items 6, 4 e 3 da Auditoria de Segurança

---

## 1. Visão Geral

Implementar 3 melhorias identificadas na auditoria de segurança do projeto "vendas-app":

- **Item 6**: Centralizar `adminProcedure` — remover 6 definições locais idênticas e usar a versão central de `server/_core/trpc.ts`
- **Item 4**: Limitar `exportData` — reduzir limite de 10.000 para 5.000 registros e adicionar validação
- **Item 3**: Tornar `getBrazilTime()` robusta — substituir `toLocaleString` double-parse por `Intl.DateTimeFormat.formatToParts()`

**Escopo**: Nenhuma funcionalidade é adicionada ou removida. Nenhum arquivo do frontend é tocado. Branch: `claude/security-code-review-MIe4M`.

---

## 2. Pré-requisitos

### Verificação de Branch
```bash
git checkout claude/security-code-review-MIe4M
# Se a branch não existir localmente:
git fetch origin claude/security-code-review-MIe4M && git checkout claude/security-code-review-MIe4M
```

### Confirmar adminProcedure Central
Verificar que o `adminProcedure` central existe em `server/_core/trpc.ts` (linhas 30-45) e já é exportado:

```typescript
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
```

**Resultado esperado**: O export existe e inclui verificação `!ctx.user || ctx.user.role !== 'admin'`

### Instalação de Dependências
**Nenhuma instalação de dependências é necessária.**

---

## 3. Passo a Passo

### ITEM 6: Centralizar adminProcedure (6 arquivos)

#### Passo 1: Editar `server/routers/sales.ts`

**Ação**: Alterar a linha de import e remover a definição local de `adminProcedure`.

**Import atual (linha 4)**:
```typescript
import { protectedProcedure, router } from "../_core/trpc";
```

**Substituir por**:
```typescript
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
```

**Remover as linhas 11-14** (definição local):
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**⚠️ IMPORTANTE**: NÃO remover `import { TRPCError }` da linha 1 — está sendo usado em outros lugares do arquivo (linhas 52, 76, 82, 89, 138, 236).

**Resultado esperado**: O arquivo compila sem erros. Todas as rotas `adminProcedure.xxx()` continuam funcionando, agora usando a versão central.

---

#### Passo 2: Editar `server/routers/auth.ts`

**Ação**: Alterar a linha de import e remover a definição local de `adminProcedure`.

**Import atual (linha 5)**:
```typescript
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
```

**Substituir por**:
```typescript
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
```

**Remover as linhas 72-76** (definição local):
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**⚠️ IMPORTANTE**:
- NÃO remover `import { TRPCError }` — está sendo usado extensivamente no restante do arquivo
- NÃO remover `protectedProcedure` do import — está sendo usado em `login`, `logout`, `me`, etc.

**Resultado esperado**: O arquivo compila sem erros.

---

#### Passo 3: Editar `server/routers/consultora.ts`

**Ação**: Alterar a linha de import e remover a definição local de `adminProcedure`.

**Import atual (linha 6)**:
```typescript
import { protectedProcedure, router } from "../_core/trpc";
```

**Substituir por**:
```typescript
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
```

**Remover as linhas 17-21** (definição local):
```typescript
// Apenas admins
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**⚠️ IMPORTANTE**:
- NÃO remover `TRPCError` — está sendo usado em `consultoraProcedure` e em outros pontos
- NÃO remover `protectedProcedure` — está sendo usado em `consultoraProcedure` (linha 10)

**Resultado esperado**: O arquivo compila sem erros.

---

#### Passo 4: Editar `server/routers/products.ts`

**Ação**: Alterar a linha de import e remover a definição local de `adminProcedure`.

**Import atual (linha 4)**:
```typescript
import { protectedProcedure, router } from "../_core/trpc";
```

**Substituir por**:
```typescript
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
```

**Remover as linhas 6-9** (definição local):
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**⚠️ IMPORTANTE**:
- NÃO remover `TRPCError` — está sendo usado nas linhas 45-49, 62-65 (update e delete de produtos do sistema)
- NÃO remover `protectedProcedure` — está sendo usado na rota `list` (linha 12)

**Resultado esperado**: O arquivo compila sem erros.

---

#### Passo 5: Editar `server/routers/reports.ts`

**Ação**: Alterar a linha de import e remover a definição local de `adminProcedure`.

**Import atual (linha 19)**:
```typescript
import { protectedProcedure, router } from "../_core/trpc";
```

**Substituir por**:
```typescript
import { adminProcedure, router } from "../_core/trpc";
```

**⚠️ NOTA IMPORTANTE**: `protectedProcedure` é REMOVIDO do import porque **NÃO é usado em nenhum outro lugar** deste arquivo (todas as rotas usam `adminProcedure`).

**Remover as linhas 21-24** (definição local):
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**⚠️ IMPORTANTE**: NÃO remover `TRPCError` — está sendo usado nas linhas 116 e 143.

**Resultado esperado**: O arquivo compila sem erros.

---

#### Passo 6: Editar `server/routers/users.ts`

**Ação**: Alterar os imports e remover a definição local de `adminProcedure`.

**Imports atuais (linhas 1 e 4)**:
```typescript
import { TRPCError } from "@trpc/server";
...
import { protectedProcedure, router } from "../_core/trpc";
```

**Remover completamente**: `import { TRPCError }` — não está sendo usado em nenhum outro lugar do arquivo

**Substituir linha 4 por**:
```typescript
import { adminProcedure, router } from "../_core/trpc";
```

**⚠️ NOTA IMPORTANTE**: Tanto `TRPCError` quanto `protectedProcedure` são REMOVIDOS porque não são usados em nenhum outro lugar deste arquivo.

**Remover as linhas 6-9** (definição local):
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});
```

**Resultado esperado após edição**, as primeiras linhas do arquivo devem ser:
```typescript
import { z } from "zod";
import { deleteUser, getAllUsers, getUserById, updateUser } from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const usersRouter = router({
```

**Resultado esperado**: O arquivo compila sem erros.

---

### ITEM 4: Limite de 5000 no exportData

#### Passo 7: Editar `server/routers/reports.ts`

**Ação**: No endpoint `exportData` (que ficará por volta da linha 62 após as remoções do Passo 5), alterar o limit e adicionar validação.

**Código atual do endpoint** (linhas 68-76 no arquivo ORIGINAL, mas as linhas terão mudado após o Passo 5):
```typescript
  exportData: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sellerId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const salesData = await getSales({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        sellerId: input.sellerId,
        limit: 10000,
      });
      return salesData;
    }),
```

**Substituir por**:
```typescript
  exportData: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sellerId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const salesData = await getSales({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        sellerId: input.sellerId,
        limit: 5000,
      });

      if (salesData.length >= 5000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A exportação retornou 5.000+ registros. Refine os filtros de data ou vendedor para no máximo 5.000 registros por exportação.",
        });
      }

      return salesData;
    }),
```

**O que mudou**:
- `limit: 10000` → `limit: 5000`
- Adicionada validação que lança erro se retornar 5000+ registros (consistente com o padrão do `exportCsv` em `sales.ts`)

**Resultado esperado**: Exportações grandes são bloqueadas com mensagem clara. `TRPCError` já está importado no arquivo (confirmado no Passo 5).

**Possíveis erros**: Nenhum esperado.

---

### ITEM 3: getBrazilTime() robusta

#### Passo 8: Editar `server/routers/consultationSlots.ts`

**Ação**: Substituir a função `getBrazilTime()` nas linhas 15-19.

**Código atual**:
```typescript
function getBrazilTime() {
  const now = new Date();
  const tzString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(tzString);
}
```

**Substituir por**:
```typescript
function getBrazilTime(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  return new Date(
    +get("year"), +get("month") - 1, +get("day"),
    +get("hour"), +get("minute"), +get("second")
  );
}
```

**⚠️ IMPORTANTE**: NÃO alterar as funções `todayStr()` (linhas 21-24) e `nowTimeStr()` (linhas 30-35) — elas dependem de `getBrazilTime()` e continuam funcionando sem mudança.

**Resultado esperado**: `getBrazilTime()` retorna o mesmo horário de antes, mas agora extrai as partes via API estruturada em vez de fazer double-parse de string.

---

#### Passo 9: Editar `server/routers/sales.ts`

**Ação**: Substituir o cálculo inline de data do Brasil nas linhas 39-41 do arquivo ORIGINAL (as linhas terão mudado após o Passo 1).

**Código atual** (dentro do mutation `create`):
```typescript
        const now = new Date();
        const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        saleDate = `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}-${String(br.getDate()).padStart(2, "0")}`;
```

**Substituir por**:
```typescript
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
        saleDate = `${get("year")}-${get("month")}-${get("day")}`;
```

**Resultado esperado**: O `saleDate` produzido é idêntico ao anterior (formato `YYYY-MM-DD`), mas agora usa `formatToParts()` em vez de double-parse.

**Possíveis erros**: Nenhum esperado. O `Intl.DateTimeFormat` com `month: "2-digit"` já retorna o mês com zero-padding (ex: "03"), então não precisa de `padStart`.

---

## 4. Validação Final

Executar os seguintes comandos na ordem após todas as edições:

### Validação 1: Nenhuma definição local de adminProcedure restante

```bash
grep -r "const adminProcedure" server/routers/
```

**Resultado esperado**: **ZERO linhas de saída**. Se alguma linha aparecer, o arquivo correspondente não foi editado corretamente — voltar ao passo correspondente.

---

### Validação 2: adminProcedure é importado em todos os 6 arquivos

```bash
grep -r "adminProcedure" server/routers/ --include="*.ts" | grep "import"
```

**Resultado esperado**: **6 linhas**, uma para cada arquivo:

```
server/routers/sales.ts:import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
server/routers/auth.ts:import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
server/routers/consultora.ts:import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
server/routers/products.ts:import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
server/routers/reports.ts:import { adminProcedure, router } from "../_core/trpc";
server/routers/users.ts:import { adminProcedure, router } from "../_core/trpc";
```

---

### Validação 3: Limite de exportData atualizado

```bash
grep -A2 "limit:" server/routers/reports.ts
```

**Resultado esperado**: Deve mostrar `limit: 5000` (não `10000`).

---

### Validação 4: getBrazilTime usa formatToParts

```bash
grep "formatToParts" server/routers/consultationSlots.ts server/routers/sales.ts
```

**Resultado esperado**: **2 linhas**, uma para cada arquivo.

---

### Validação 5: Compilação TypeScript

```bash
npx tsc --noEmit
```

**Resultado esperado**: **ZERO erros**. Se houver erros, ler a mensagem com atenção — provavelmente é um import faltando ou sobrando. Corrigir o arquivo indicado e rodar novamente.

---

### Validação 6: Verificar que nenhum arquivo do frontend foi alterado

```bash
git diff --name-only
```

**Resultado esperado**: Apenas estes 7 arquivos devem aparecer:

```
server/routers/sales.ts
server/routers/auth.ts
server/routers/consultora.ts
server/routers/products.ts
server/routers/reports.ts
server/routers/users.ts
server/routers/consultationSlots.ts
```

Se qualquer arquivo em `client/` aparecer, houve um erro. Reverter com:
```bash
git checkout -- client/
```

---

## 5. Regras de Execução para o Executor

### O que o executor NÃO pode fazer:

- ❌ NÃO alterar nenhum arquivo que não esteja listado nos passos acima
- ❌ NÃO alterar nenhum arquivo dentro de `client/`
- ❌ NÃO adicionar funcionalidades, imports, dependências ou lógica nova
- ❌ NÃO alterar mensagens de erro existentes (exceto a remoção do `adminProcedure` local)
- ❌ NÃO renomear variáveis, funções ou rotas
- ❌ NÃO alterar as funções `todayStr()`, `nowTimeStr()` ou `effectiveStatus()` em `consultationSlots.ts`
- ❌ NÃO remover imports que ainda são usados no arquivo (verificar antes de remover)
- ❌ NÃO adicionar comentários, docstrings ou type annotations além do que está especificado
- ❌ NÃO fazer push para outra branch que não seja `claude/security-code-review-MIe4M`
- ❌ NÃO fazer alterações em `server/_core/trpc.ts` — o arquivo central **NÃO muda**

### O que fazer se algo der errado:

**Erro de compilação TypeScript**:
- Ler a mensagem de erro com atenção
- Se indicar import faltando, adicionar
- Se indicar import não usado, remover
- Rodar `npx tsc --noEmit` novamente

**grep mostra definição local restante**:
- Voltar ao passo correspondente do arquivo indicado e completar a edição

**git diff mostra arquivo inesperado**:
- Reverter o arquivo com `git checkout -- <arquivo>`

**Se qualquer passo falhar e não souber corrigir**:
- ⛔ PARAR e reportar o erro exato (arquivo, linha, mensagem)
- ❌ NÃO tentar soluções criativas

---

## 6. Commit e Push

Após todas as validações passarem:

```bash
git add server/routers/sales.ts server/routers/auth.ts server/routers/consultora.ts server/routers/products.ts server/routers/reports.ts server/routers/users.ts server/routers/consultationSlots.ts

git commit -m "refactor: centralizar adminProcedure, limitar exportData, getBrazilTime robusto

- Remove 6 definições locais de adminProcedure, usa export central de _core/trpc.ts
- Reduz limite de exportData de 10000 para 5000 com validação
- Substitui toLocaleString double-parse por Intl.DateTimeFormat.formatToParts()

https://claude.ai/code/session_01KRujxhaBXbAWWSsM2Uxxws"

git push -u origin claude/security-code-review-MIe4M
```

---

## Status de Execução

**[Estado: COMPLETADO ✅]**

Este plano já foi **totalmente executado** e validado. Todos os 7 arquivos foram alterados, compilação passou, e commits foram realizados.

- ✅ Commit de refatoração: `6e95840`
- ✅ Commit de documentação: `ae038e0`
- ✅ Push para branch: `claude/security-code-review-MIe4M`

Para detalhes das alterações, consulte: [ALTERACOES_SEGURANCA_RESUMO.md](ALTERACOES_SEGURANCA_RESUMO.md)

---

*Plano de Execução — Auditoria de Segurança do Vendas-App | 27/03/2026*
