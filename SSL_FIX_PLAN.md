# PLANO 2: SSL_FIX_PLAN.md
## Plano de Execução: SSL rejectUnauthorized: true

---

## 1. Visão Geral

Alterar `rejectUnauthorized: false` para `rejectUnauthorized: true` em **3 arquivos** que conectam ao PostgreSQL do Railway. Isso habilita a verificação do certificado SSL do servidor de banco de dados, prevenindo ataques **Man-in-the-Middle**.

Como o app não está em uso real (apenas em deploy), é seguro testar agora. Se o Railway não fornecer um certificado verificável, a conexão vai falhar — nesse caso, reverter.

**Branch**: `claude/security-code-review-MIe4M`

---

## 2. Pré-requisitos

### Verificação de Branch
```bash
git checkout claude/security-code-review-MIe4M
```

### Plano Anterior
O plano anterior (9 passos: `adminProcedure`, `exportData`, `getBrazilTime`) deve ter sido executado **ANTES** deste plano — caso contrário, as linhas podem não bater.

**Status**: ✅ PLANO 1 já foi completado (commits 6e95840 e ae038e0)

### Instalação de Dependências
**Nenhuma instalação de dependências é necessária.**

---

## 3. Passo a Passo

### Passo 1: Editar `server/db.ts`

**Ação**: Alterar `rejectUnauthorized: false` para `rejectUnauthorized: true` na linha 20.

**Código atual (linha 20)**:
```typescript
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
```

**Substituir por**:
```typescript
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
```

**⚠️ IMPORTANTE**: NÃO alterar nenhuma outra linha do arquivo.

**Resultado esperado**: A Pool de conexão agora valida o certificado SSL do servidor PostgreSQL em produção.

---

### Passo 2: Editar `scripts/create-admin.mjs`

**Ação**: Alterar `rejectUnauthorized: false` para `rejectUnauthorized: true` na linha 14.

**Código atual (linha 14)**:
```javascript
  ssl: { rejectUnauthorized: false },
```

**Substituir por**:
```javascript
  ssl: { rejectUnauthorized: true },
```

**⚠️ IMPORTANTE**: NÃO alterar nenhuma outra linha do arquivo.

**Resultado esperado**: O script de criação de admin valida o certificado SSL.

---

### Passo 3: Editar `scripts/migrate-railway.mjs`

**Ação**: Alterar `rejectUnauthorized: false` para `rejectUnauthorized: true` na linha 19.

**Código atual (linha 19)**:
```javascript
  ssl: { rejectUnauthorized: false },
```

**Substituir por**:
```javascript
  ssl: { rejectUnauthorized: true },
```

**⚠️ IMPORTANTE**: NÃO alterar nenhuma outra linha do arquivo.

**Resultado esperado**: O script de migração valida o certificado SSL.

---

## 4. Validação Final

### Validação 1: Verificar que não resta nenhum `rejectUnauthorized: false` no código

```bash
grep -r "rejectUnauthorized: false" server/ scripts/
```

**Resultado esperado**: **ZERO linhas de saída**. Se alguma linha aparecer, o arquivo correspondente não foi editado — voltar ao passo correspondente.

**NOTA**: Os arquivos `fixes.md` e `SECURITY_AUDIT_REPORT.md` também contêm `rejectUnauthorized: false` em texto de documentação — isso é **esperado** e **NÃO deve ser alterado**.

---

### Validação 2: Verificar que todos os 3 arquivos têm `rejectUnauthorized: true`

```bash
grep -r "rejectUnauthorized: true" server/ scripts/
```

**Resultado esperado**: **3 linhas**:

```
server/db.ts: ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
scripts/create-admin.mjs: ssl: { rejectUnauthorized: true },
scripts/migrate-railway.mjs: ssl: { rejectUnauthorized: true },
```

---

### Validação 3: Compilação TypeScript

```bash
npx tsc --noEmit
```

**Resultado esperado**: **ZERO erros**. (Os scripts `.mjs` não são verificados pelo TypeScript, apenas `server/db.ts`.)

---

### Validação 4: Verificar que nenhum arquivo do frontend foi alterado

```bash
git diff --name-only
```

**Resultado esperado**: Apenas estes 3 arquivos:

```
server/db.ts
scripts/create-admin.mjs
scripts/migrate-railway.mjs
```

Se qualquer outro arquivo aparecer, houve um erro. Reverter com:
```bash
git checkout -- <arquivo>
```

---

## 5. Teste de Conexão (CRÍTICO)

**APÓS o commit e push**, é necessário verificar se o deploy no Railway ainda funciona:

1. Acessar o app no Railway e verificar se a página carrega
2. Se possível, verificar o endpoint de health check: `GET /api/health` — deve retornar status 200 com "ok"
3. Se o app não conectar ao banco (erro 503 no health check ou página não carrega), significa que o Railway usa certificados auto-assinados que não passam na verificação

### Se a Conexão Falhar:

Reverter os 3 arquivos ao estado anterior:

```bash
git revert HEAD --no-edit
git push -u origin claude/security-code-review-MIe4M
```

Isso cria um novo commit revertendo a mudança, sem perder histórico.

---

## 6. Regras de Execução para o Executor

### O que o executor NÃO pode fazer:

- ❌ NÃO alterar nenhum arquivo que não esteja listado nos passos acima
- ❌ NÃO alterar `fixes.md` ou `SECURITY_AUDIT_REPORT.md`
- ❌ NÃO alterar nenhum arquivo dentro de `client/`
- ❌ NÃO remover a lógica condicional `process.env.NODE_ENV === "production"` em `server/db.ts`
- ❌ NÃO adicionar nenhuma lógica ou import novo
- ❌ NÃO fazer push para outra branch que não seja `claude/security-code-review-MIe4M`

### O que fazer se algo der errado:

**Erro de compilação TypeScript**:
- Ler a mensagem
- Provavelmente digitou algo errado — comparar com o código esperado

**grep mostra `rejectUnauthorized: false` restante**:
- Voltar ao passo do arquivo indicado

**Se qualquer passo falhar**:
- ⛔ PARAR e reportar o erro exato

---

## 7. Commit e Push

Após todas as validações passarem:

```bash
git add server/db.ts scripts/create-admin.mjs scripts/migrate-railway.mjs

git commit -m "security: habilitar verificação SSL do PostgreSQL (rejectUnauthorized: true)

- Altera rejectUnauthorized de false para true em 3 arquivos
- Habilita validação de certificado SSL na conexão com o banco
- Se Railway não suportar, reverter com git revert HEAD

https://claude.ai/code/session_01KRujxhaBXbAWWSsM2Uxxws"

git push -u origin claude/security-code-review-MIe4M
```

---

## Status de Execução

**[Estado: PENDENTE 🔄]**

Aguardando execução do plano.

---

*Plano de Execução — SSL/TLS Hardening do Vendas-App | 27/03/2026*
