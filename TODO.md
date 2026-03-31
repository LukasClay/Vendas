# TODO - Fixar Desconexão Real de Usuário no ADM Segurança

## ✅ Plano Aprovado pelo Usuário
- [ ] 1. Criar este TODO.md com passos detalhados
- [x] 2. Editar `server/routers/security.ts` : Adicionar increment sessionVersion do userId da sessão ANTES de deletar user_sessions

- [ ] 3. Testar via UI: servidor deve estar rodando, fazer login em outra aba, desconectar via ADM → logout automático
- [ ] 4. Verificar audit log tem userId na details
- [ ] 5. `attempt_completion` com comando para testar (ex: refresh página)

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

*Última IA travou aqui. BLACKBOXAI prossegue.*

