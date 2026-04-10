# 📋 PLANOS DE EXECUÇÃO - Consolidado

Documentação de todos os planos de refatoração e hardening implementados.

---

## 📑 Índice

1. [Plano 1: Refactor de Segurança](#plano-1-refactor-de-segurança)
2. [Plano 2: SSL/TLS Hardening](#plano-2-ssltls-hardening)
3. [Resumo SSL de Alterações](#resumo-ssl-de-alterações)

---

# Plano 1: Refactor de Segurança

## Plano de Execução: Items 6, 4 e 3 da Auditoria de Segurança

---

## 1. Visão Geral

Implementar 3 melhorias identificadas na auditoria de segurança:

- **Item 6**: Centralizar `adminProcedure` — remover 6 definições locais idênticas
- **Item 4**: Limitar `exportData` — reduzir limite de 10.000 para 5.000 + validação
- **Item 3**: Tornar `getBrazilTime()` robusta — substituir `toLocaleString` double-parse por `Intl.DateTimeFormat.formatToParts()`

**Escopo**: Nenhuma funcionalidade novo/removida. Nenhum arquivo frontend. Branch: `claude/security-code-review-MIe4M`.

---

## 2. Pré-requisitos

### Verificação de Branch

```bash
git checkout claude/security-code-review-MIe4M
```

### Confirmar adminProcedure Central

Verificar que existe em `server/_core/trpc.ts`:

```typescript
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx });
  })
);
```

**Resultado esperado**: Export existe com verificação correta ✅

---

## 3. Arquivos Alterados

### ITEM 6: 6 arquivos com adminProcedure centralizado

**Files:**

- server/routers/sales.ts
- server/routers/auth.ts
- server/routers/consultora.ts
- server/routers/products.ts
- server/routers/reports.ts
- server/routers/users.ts

**Ação por arquivo:**

1. Alterar import para incluir `adminProcedure` de `_core/trpc`
2. Remover definição local de `adminProcedure`
3. Manter imports que ainda são usados (`TRPCError`, `protectedProcedure`)

---

### ITEM 4: Limite de 5000 no exportData

**File:** server/routers/reports.ts

**Alteração:**

```typescript
// Limite: 10000 → 5000
limit: 5000,

// Adicionar validação:
if (salesData.length >= 5000) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A exportação retornou 5.000+ registros. Refine os filtros de data ou vendedor para no máximo 5.000 registros por exportação.",
  });
}
```

---

### ITEM 3: getBrazilTime() robusta

**Files:**

1. server/routers/consultationSlots.ts
2. server/routers/sales.ts

**Antes (double-parse):**

```typescript
const now = new Date();
const br = new Date(
  now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
);
```

**Depois (formatToParts):**

```typescript
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
return new Date(+get("year"), +get("month") - 1, +get("day"), ...);
```

---

## 4. Validações

### Validação 1: Nenhuma definição local restante

```bash
grep -r "const adminProcedure" server/routers/
→ Esperado: 0 linhas
```

### Validação 2: 6 imports centralizados

```bash
grep -r "import.*adminProcedure" server/routers/
→ Esperado: 6 linhas (uma por arquivo)
```

### Validação 3: Limite 5000

```bash
grep "limit: 5000" server/routers/reports.ts
→ Esperado: 1 linha
```

### Validação 4: formatToParts

```bash
grep "formatToParts" server/routers/consultationSlots.ts server/routers/sales.ts
→ Esperado: 2 linhas
```

### Validação 5: TypeScript compila

```bash
npx tsc --noEmit
→ Esperado: Zero erros
```

---

## Status de Execução

**[✅ COMPLETADO]**

- ✅ Commit de refatoração: `6e95840`
- ✅ Commit de documentação: `ae038e0`
- ✅ Push para branch: `claude/security-code-review-MIe4M`

---

# Plano 2: SSL/TLS Hardening

## Plano de Execução: SSL rejectUnauthorized: true

---

## 1. Visão Geral

Alterar `rejectUnauthorized: false` para `rejectUnauthorized: true` em **3 arquivos** que conectam ao PostgreSQL do Railway.

Isso habilita verificação do certificado SSL do servidor de banco, prevenindo ataques **Man-in-the-Middle**.

**Branch**: `claude/security-code-review-MIe4M`

---

## 2. Pré-requisitos

### Verificação de Branch

```bash
git checkout claude/security-code-review-MIe4M
```

### Plano 1 Status

O Plano 1 deve ter sido executado ANTES. Status: ✅ COMPLETADO

---

## 3. Passo a Passo

### Passo 1: `server/db.ts`

```typescript
// ANTES:
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,

// DEPOIS:
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
```

### Passo 2: `scripts/create-admin.mjs`

```javascript
// ANTES:
ssl: { rejectUnauthorized: false },

// DEPOIS:
ssl: { rejectUnauthorized: true },
```

### Passo 3: `scripts/migrate-railway.mjs`

```javascript
// ANTES:
ssl: { rejectUnauthorized: false },

// DEPOIS:
ssl: { rejectUnauthorized: true },
```

---

## 4. Validações

### Validação 1: Zero `rejectUnauthorized: false`

```bash
grep -r "rejectUnauthorized: false" server/ scripts/
→ Esperado: 0 linhas
```

### Validação 2: 3 ocorrências de true

```bash
grep -r "rejectUnauthorized: true" server/ scripts/
→ Esperado: 3 linhas
```

### Validação 3: TypeScript compila

```bash
npx tsc --noEmit
→ Esperado: Zero erros
```

---

## 5. Teste Crítico

**Após deploy no Railway:**

1. Verificar se app carrega
2. Verificar health check: `GET /api/health` → 200 com "ok"
3. Se falhar, reverter com `git revert HEAD --no-edit`

---

## Status de Execução

**[✅ COMPLETADO]**

- ✅ Commit: `089afe3`
- ✅ Alterações aplicadas
- ✅ Validações passaram

---

# Resumo SSL de Alterações

## SSL/TLS HARDENING - RESUMO

**Data**: 27/03/2026 | **Commit**: 089afe3

---

## 📋 RESUMO EXECUTIVO

Implementadas alterações de segurança SSL/TLS em **3 arquivos**, habilitando verificação de certificado SSL do PostgreSQL no Railway.

- ✅ **Passo 1**: `server/db.ts`
- ✅ **Passo 2**: `scripts/create-admin.mjs`
- ✅ **Passo 3**: `scripts/migrate-railway.mjs`

---

## 🔒 Impacto de Segurança

### Antes (rejectUnauthorized: false):

- ❌ Conecta sem validar certificado
- ❌ Vulnerável a **Man-in-the-Middle**
- ❌ Credenciais podem ser capturadas

### Depois (rejectUnauthorized: true):

- ✅ Valida certificado SSL genuíno
- ✅ Previne MitM
- ✅ Garante servidor legítimo
- ✅ Zero impacto de performance

---

## 📊 ESTATÍSTICAS

| Métrica                         | Número       |
| ------------------------------- | ------------ |
| Arquivos alterados              | 3            |
| Linhas alteradas                | 3            |
| `rejectUnauthorized` alterações | 3            |
| Lógica condicional removida     | 0            |
| Compilação TypeScript           | ✅ Sem erros |

---

_Consolidação de Planos de Execução em 27/03/2026_
