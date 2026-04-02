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

| Tipo de mudança | Incremento | Exemplo (partindo de 2.2.0) |
|---|---|---|
| Pequena (fix, ajuste visual, texto) | `+0.0.1` | 2.2.0 → 2.2.1 |
| Média (nova feature, melhoria relevante) | `+0.1.0` | 2.2.0 → 2.3.0 |
| Grande (novo sistema, refactor estrutural) | `+1.0.0` | 2.2.0 → 3.0.0 |

**Versão atual: `2.2.0`**

*Última IA travou aqui. BLACKBOXAI prossegue.*

