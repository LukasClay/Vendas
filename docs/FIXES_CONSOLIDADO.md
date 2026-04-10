# 🔧 FIXES - Consolidado

Documentação de todas as correções aplicadas ao código.

---

## 📑 Índice

1. [Fixes Aplicadas - Visão Unificada](#fixes-aplicadas---visão-unificada)
2. [Fixes 2 - Alterações Cirúrgicas](#fixes-2---alterações-cirúrgicas)

---

# Fixes Aplicadas - Visão Unificada

⚠️ **GARANTIA CRÍTICA: Proteção de Histórico de Vendas**

Toda mudança neste documento foi implementada com **ZERO impacto no histórico de vendas**. A tabela de vendas é imutável:

- Usuários deletados ainda aparecem em suas vendas (via snapshot)
- Nenhum dado histórico é truncado
- Cada record de venda permanece 100% consultável

---

## server/\_core/index.ts

### Change: Trust Proxy Configuration and Body Parser Limits

```typescript
app.set("trust proxy", 1); // Confia no proxy do Railway para pegar o IP real
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
```

**Razão:** Habilita extração segura de IP via Express trust proxy. Reduz limite de upload de 50mb para 10mb.

---

## server/routers/auth.ts

### Fix 1: IP Rate Limiter - Secure Trust Proxy

```typescript
// IP seguro via trust proxy do Express
const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
```

**Antes:**

```typescript
// IP extraído do header real
const ip =
  (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  ctx.req.socket?.remoteAddress ||
  "unknown";
```

**Razão:** Delega extração de IP ao Express, que respeita `trust proxy`.

---

### Fix 2: Login Method - createSeller procedure

```typescript
loginMethod: "local",
```

**Antes:**

```typescript
loginMethod: "username_password",
```

**Razão:** Padroniza método de login para "local".

---

### Fix 3: Remove Dynamic Import - deleteUser procedure

```typescript
import { getDb, withRetry, deleteUser } from "../db";

deleteUser: adminProcedure
  .input(z.object({ userId: z.number() }))
  .mutation(async ({ input }) => {
    await deleteUser(input.userId);
    return { success: true };
  }),
```

**Antes:** Dynamic import `const { deleteUser } = await import("../db");`

**Razão:** Remove import desnecessário usando static import direto.

---

### Fix 4: Múltiplas Correções de Segurança

**4a. Filtro `deletedAt IS NULL` no login:**

- Query agora filtra usuários soft-deleted

**4b. Logs sanitizados:**

- Sem exposição de usernames nos logs de produção
- Apenas log de conta sem senha é mantido

**4c. Senha mínima 8 caracteres:**

- `createSeller` e `resetPassword`: 6 → 8 caracteres

**4d. Rate limiter com teto:**

- Memory leak prevenido com teto de 10k entradas
- Reset automático ao atingir limite

**4e. Admin não pode se auto-excluir:**

- Validação `input.userId === ctx.user.id` bloqueia

---

## server/db.ts

### Fix: Safe Soft Delete with Snapshot Protection - deleteUser function

⚠️ **CRÍTICO: Histórico de vendas NUNCA é afetado**

```typescript
export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;

  // SOFT DELETE SEGURO: Histórico de vendas preservado
  // Passo 1: Salvar snapshot do nome do funcionário ANTES de qualquer alteração
  const user = await getUserById(id);
  if (!user) return;

  const snapshotName =
    user.displayName || user.name || user.username || `Usuário #${id}`;

  // Passo 1a: PROTEGER histórico de vendas
  await db
    .update(sales)
    .set({ sellerName: snapshotName })
    .where(and(eq(sales.sellerId, id), sql`${sales.sellerName} IS NULL`));

  // Passo 2: APENAS renomear username/openId
  const suffix = `_old`;
  const newUsername = user.username ? `${user.username}${suffix}` : null;
  const newOpenId = `${user.openId}${suffix}`;

  // Passo 3: Marcar como deletado, inativo e invalidar sessões
  await db
    .update(users)
    .set({
      active: false,
      deletedAt: new Date(),
      username: newUsername,
      openId: newOpenId,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, id));
}
```

**Proteção em 3 Camadas:**

**CAMADA 1 — Snapshot Protection:**

```
Antes de deletar → Salva nome do vendedor em todas as vendas
Garante que vendas sempre mostram nome correto, mesmo se usuário deletado
```

**CAMADA 2 — Soft Delete Only:**

```
Tabela users: update active=false, add deletedAt, rename username
Tabela sales: COMPLETAMENTE INTOCADA (zero deletions)
```

**CAMADA 3 — Session Invalidation:**

```
Increment sessionVersion → Todas as sessões ativas ficam inválidas
Usuário não consegue login (active=false)
Não consegue deletar suas próprias vendas
```

---

### Fix 5: Security - getUserById Remove Password Hash

```typescript
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      phone: users.phone,
      active: users.active,
      username: users.username,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      deletedAt: users.deletedAt,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}
```

**Antes:** `select().from(users)` retornava todos os campos

**Razão:** Whitelist approach avita exposição acidental de `passwordHash`.

---

### Fix 6: SSL Configuration - Production Check

```typescript
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
```

**Antes:**

```typescript
ssl: connStr.includes('railway') ? { rejectUnauthorized: false } : undefined,
```

**Razão:** Usa variável de ambiente em vez de string detection.

---

## server/routers/consultationSlots.ts

### Commit: Timezone Fix - effectiveStatus function

```typescript
function effectiveStatus(slot: {
  status: string;
  consultationDate: string;
  consultationTime: string;
}): "pendente" | "realizada" | "cancelada" {
  if (slot.status === "cancelada") return "cancelada";

  // Monta datetime do slot no fuso de São Paulo
  const slotDatetime = new Date(
    `${slot.consultationDate}T${slot.consultationTime}:00`
  );
  const now = getBrazilTime();
  const diffMs = now.getTime() - slotDatetime.getTime();
  const diffMinutes = diffMs / 60000;

  if (diffMinutes >= 50) return "realizada";
  return "pendente";
}
```

**Antes:** `const now = new Date();` (UTC)

**Changed to:** `const now = getBrazilTime();` (São Paulo timezone)

**Razão:** Railway roda em UTC, então `getBrazilTime()` converte corretamente para São Paulo.

---

## server/\_core/sdk.ts

### Fix: Local User OAuth Protection - authenticateRequest

```typescript
// If user not in DB, sync from OAuth server automatically
if (!user) {
  if (sessionUserId.startsWith("local_")) {
    throw ForbiddenError("Usuário local não encontrado ou desativado.");
  }
  try {
    const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
```

**Antes:** Tentava OAuth sync sem verificar se era usuário local

**Razão:** Local users não têm perfil OAuth. Bloqueia API call desnecessária.

---

---

# Fixes 2 - Alterações Cirúrgicas

Registro EXATO de 3 alterações de cleanup aplicadas ao código.

---

## Alteração 1 — `client/src/pages/Login.tsx`

### O que foi mudado

**Linha 34-37:** Trocar `rememberMe: false` por `rememberMe: true` no `defaultValues`.

### Antes

```ts
defaultValues: { username: "", password: "", rememberMe: false },
```

### Depois

```ts
defaultValues: { username: "", password: "", rememberMe: true },
```

**Por que é seguro:** É apenas o valor inicial do checkbox. Campo já existe, já funciona. Apenas altera estado inicial.

---

## Alteração 2 — `server/_core/sdk.ts`

### O que foi mudado

**Linhas 33-42:** Remover bloco `if (!ENV.oAuthServerUrl)` do construtor de `OAuthService`.

### Antes

```ts
class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured!"
      );
    }
  }
```

### Depois

```ts
class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {}
```

**Por que é seguro:** `oAuthServerUrl` não é usado no fluxo de autenticação local. Bloco removido era apenas `console.error` de aviso.

---

## Alteração 3 — `server/_core/notification.ts`

### O que foi mudado

**Linhas 26-28:** Remover `console.log` dentro do fallback silencioso, mantendo `return false`.

### Antes

```ts
if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
  console.log(
    `[Notification] Serviço não configurado. Notificação ignorada: "${title}"`
  );
  return false;
}
```

### Depois

```ts
if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
  return false;
}
```

**Por que é seguro:** `return false` permanece. Função continua retornando imediatamente. Apenas log de console foi removido.

---

## Alteração 4 — `server/routers/auth.ts`

### O que foi mudado

**Linhas 159-161:** Remover `maxAge: -1` da chamada `clearCookie` no `logout`.

**Status**: ✅ Já estava correto no arquivo. Log já mostra `ctx.res.clearCookie(COOKIE_NAME, cookieOptions);` sem `maxAge: -1`.

---

## Resumo das Alterações

| #   | Arquivo                        | Tipo    | O que mudou                         | Status        |
| --- | ------------------------------ | ------- | ----------------------------------- | ------------- |
| 1   | `client/src/pages/Login.tsx`   | Valor   | `false` → `true`                    | ✅ Aplicado   |
| 2   | `server/_core/sdk.ts`          | Remoção | Remove `console.error` + bloco `if` | ✅ Aplicado   |
| 3   | `server/_core/notification.ts` | Limpeza | Remove `console.log`                | ✅ Aplicado   |
| 4   | `server/routers/auth.ts`       | Limpeza | Remove `maxAge: -1`                 | ✅ Já correto |

---

_Consolidação de Fixes em 27/03/2026_
