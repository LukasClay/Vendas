# TODO - Fixar Desconexão Real de Usuário no ADM Segurança

## ✅ Plano Aprovado pelo Usuário
- [x] 1. Criar este TODO.md com passos detalhados
- [x] 2. Editar `server/routers/security.ts` : Adicionar increment sessionVersion do userId da sessão ANTES de deletar user_sessions

- [x] 3. Testar via UI: servidor deve estar rodando, fazer login em outra aba, desconectar via ADM → logout automático
- [x] 4. Verificar audit log tem userId na details
- [x] 5. `attempt_completion` com comando para testar (ex: refresh página)

## Detalhes da Edição
**Arquivo:** `server/routers/security.ts` - mutation `disconnectSession`
**Mudança:** 
1. Buscar session = await getAllUserSessions(), find by sessionId → get userId
2. Se userId: `db.update(users).set({ sessionVersion: sql\`${users.sessionVersion} + 1\` }).where(eq(users.id, userId))`
3. Audit details: `{ sessionId, targetUserId: userId }`
4. THEN `deleteUserSession(sessionId)`

**Sem mudanças no frontend** (Seguranca.tsx já passa sessionId correto)

**Resultado Esperado:** Desconectar força logout real via JWT invalidation em todas tabs/devices do usuário alvo.

---

## 📌 Regra de Versionamento (para qualquer IA ou dev que alterar o código)

Ao finalizar alterações, avalie o peso das mudanças feitas, consulte a versão atual em `client/src/pages/admin/Configuracoes.tsx` e atualize de acordo:

| Tipo de mudança | Incremento | Exemplo (partindo de 2.3.0) |
|---|---|---|
| Pequena (fix, ajuste visual, texto) | `+0.0.1` | 2.3.0 → 2.3.1 |
| Média (nova feature, melhoria relevante) | `+0.1.0` | 2.3.0 → 2.4.0 |
| Grande (novo sistema, refactor estrutural) | `+1.0.0` | 2.3.0 → 3.0.0 |

**Versão atual: `2.3.0`**

---

## 🏗️ Arquitetura & Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TailwindCSS + shadcn/ui |
| Backend | Express + tRPC (type-safe end-to-end) |
| Banco | PostgreSQL (Railway) via Drizzle ORM |
| Storage | Cloudflare R2 (S3-compatible) — plano free: 10GB |
| Auth | JWT + sessionVersion (invalidação forçada) |
| Deploy | Railway — branch `main` = produção automática |

**Migrations:** não usar `drizzle-kit push` em produção — usa `ensureXxxColumns()` no startup (`server/db.ts`) com `ALTER TABLE IF NOT EXISTS`. Padrão já estabelecido para `isSystem` e `photoColumns`.

---

## ⚡ Regras de Performance — CRÍTICO

> **Contexto:** Vendedoras e consultoras acessam o sistema pelo celular próprio, frequentemente com internet móvel limitada (3G/4G fraco). Qualquer regressão de performance nessas telas impacta diretamente o trabalho delas.

### Painéis prioritários (do mais crítico ao menos crítico)
1. `NovaVenda.tsx` — vendedora registra venda no celular, muitas vezes em campo
2. `Consultora.tsx` — consultora consulta trabalhos pendentes pelo celular
3. `admin/*` — ADM geralmente acessa via desktop/Wi-Fi, menor criticidade

### O que NUNCA fazer nos painéis de vendedora e consultora

- **Não adicionar animações** (framer-motion, transitions pesadas) — use CSS simples ou nada
- **Não carregar dependências novas** sem avaliar o impacto no bundle — cada KB importa
- **Não fazer queries adicionais** no carregamento inicial da página — cada request é latência extra
- **Não renderizar componentes pesados** condicionalmente sem lazy loading
- **Não usar `useEffect` para buscar dados** — usar tRPC queries diretamente (já tem cache)
- **Não adicionar imagens sem dimensões fixas** — causa layout shift (CLS) perceptível em mobile

### O que é permitido no ADM (menor criticidade)
- Animações com framer-motion ✓
- Modais complexos com múltiplos estados ✓
- Tabelas com muitos dados e filtros ✓
- Dependências extras de visualização ✓

### Checklist antes de qualquer PR que toque em `NovaVenda.tsx` ou `Consultora.tsx`
- [ ] A mudança adiciona alguma dependência nova ao bundle?
- [ ] Há novas chamadas de API no carregamento inicial?
- [ ] Há animações ou transições adicionadas?
- [ ] O componente renderiza corretamente em tela de 375px (iPhone SE)?
- [ ] A mudança funciona com conexão lenta (simular throttling no DevTools)?

---

## 🗂️ Estrutura de Pastas Relevante

```
server/
  _core/index.ts       ← startup: ensureSystemProducts, ensurePhotoColumns
  db.ts                ← todas as funções de banco + auto-migrações
  routers/
    sales.ts           ← criar/editar vendas, upload comprovante + fotos
    consultora.ts      ← queries para painel da consultora (toWrite, pending, done)
    security.ts        ← sessões, desconexão forçada, audit log
client/src/pages/
  NovaVenda.tsx        ← formulário de nova venda (vendedora) ⚡ CRÍTICO
  Consultora.tsx       ← painel de trabalhos da consultora ⚡ CRÍTICO
  admin/
    Vendas.tsx         ← todas as vendas + modal de detalhes + modal de edição
    Dashboard.tsx      ← gráficos e resumos
    Seguranca.tsx      ← gestão de sessões e auditoria
shared/
  const.ts             ← constantes globais (TYPES_WITH_PHOTOS, COOKIE_NAME, etc.)
drizzle/
  schema.ts            ← fonte da verdade do schema do banco
```

---

## 🔒 Regras de Segurança

- **Nunca expor** `attachmentKey` ou `photoKey` para o frontend — apenas as URLs públicas
- **Validar tamanho e MIME** tanto no cliente quanto no servidor (já implementado)
- **Toda ação sensível** (deletar venda, desconectar usuário, exportar dados) deve gerar audit log em `createAuditLog()`
- **Uploads** vão para paths separados: `comprovantes/{userId}/` e `fotos/{userId}/` — nunca misturar
- **`adminProcedure`** para tudo que o ADM faz — nunca usar `protectedProcedure` em rotas de admin

---

## 📦 Cloudflare R2 — Monitoramento

- **Plano free:** 10GB storage, 1M writes/mês, 10M reads/mês
- **Consumo atual estimado:** ~150MB/mês (comprovantes) + fotos individuais a partir da v2.3.0
- **Paths:** `comprovantes/{userId}/{nanoid}.ext` e `fotos/{userId}/{nanoid}.ext`
- **Atenção:** arquivos órfãos (comprovante/foto trocados) não são deletados automaticamente — monitorar crescimento do bucket periodicamente
