# Prompt para correcao por etapas das auditorias tecnicas — edicao Claude

> Copia de trabalho. Itens corrigidos sao marcados com `[x] CORRIGIDO` e trazem nota do commit.
> Arquivo original preservado em `auditorias-consolidadas-2026-04-24.md`.

## Painel de progresso

### Sprint 0 — Fogo imediato
- [x] C1 — IDOR consultora (markWritten/markDone/undoDone) — **CORRIGIDO (revisado)**
- [x] C3 (parte 1) — Master password sem fallback hardcoded — **CORRIGIDO**
- [x] C4 — Validacao Zod em payload Manus — **CORRIGIDO**
- [ ] A4 — Remover `refetchOnMount: "always"` em Consultora.tsx
- [ ] M1 — Cookie logout com `maxAge: 0`

#### Nota de execucao — C1 (revisado)
O fix proposto pela Auditoria 1 (`eq(sales.sellerId, ctx.user.id)`) era
falso positivo: o painel da Consultora foi desenhado como **workboard
compartilhado** — nao ha `consultoraId`, as queries listam todos os
trabalhos pendentes para qualquer consultora processar. Aplicar o filtro
original quebraria o funcionamento basico do painel.

Investigacao no codigo revelou **dois invariantes reais** violados pelas
mesmas 3 mutations, que passaram desapercebidos pela auditoria:

1. Nao filtravam `ne(sales.productName, "Consulta Cartas")` — permitindo
   alterar o `workStatus` de vendas de Consulta Cartas (que tem ciclo
   proprio via `consultation_slots` com auto "realizada" +50min).
2. Nao filtravam `isNull(sales.deletedAt)` — permitindo alterar status
   de vendas na lixeira, deixando-as em estado inesperado ao restaurar.

Ambos os filtros ja existiam em todas as outras queries/filtros do
router (`toWrite`, `pending`, `done`, `alerts`, `statusCounts`,
`worksSummary`, `distinctProducts`, `bulkUpdate*`). As mutations foram
endurecidas para a mesma invariante.

Arquivos: `server/routers/consultora.ts`, `server/consultora.mutations.test.ts` (novo).
Testes adicionados: 4 (cobertura dos 3 verbos + admin tambem).

#### Nota de execucao — C3 (parte 1)
Fallback SHA256 hardcoded (`"2259180d..."`) removido. A env
`MASTER_PASSWORD_HASH` passa a ser obrigatoria — servidor falha no boot
se ausente, via `assertMasterPasswordConfigured()` chamada no topo de
`startServer()` (padrao "fail fast" para misconfiguracao).

Tambem adicionado check defensivo de `length` antes de
`crypto.timingSafeEqual` (que so aceita buffers de tamanho igual).

ATENCAO OPERACIONAL (nao e parte deste commit): o valor atual do hash
em producao e identico ao fallback publico que estava no repo.
Ou seja, a senha mestre real esta comprometida — quem clonou o repo
tem acesso a um hash SHA256 rapido de quebrar. Rotacao da senha
mestre deve ser feita ASAP. Migracao de SHA256 para bcrypt fica para
M13 (sprint futuro).

Arquivos: `server/routers/security.ts`, `server/_core/index.ts`,
`server/security.masterPassword.test.ts` (novo).
Testes adicionados: 3 (ausente, vazia, presente).

#### Nota de execucao — C4
Respostas JSON da API Manus (upload e downloadUrl) agora passam por
`ManusUrlResponse.parse(...)` antes de extrair `.url`. O schema e
`z.object({ url: z.string().url() })`. Se o provedor retornar
`{ error: "..." }` ou qualquer payload sem URL valida, falhamos cedo
com ZodError em vez de gravar `undefined` como URL da venda.

Arquivos: `server/storage.ts`, `server/storage.manus.test.ts` (novo).
Testes adicionados: 7 (valido, extras, sem url, vazia, nao-absoluta,
undefined, nao-objeto).

### Sprint 1 — Robustez
- [ ] C2 + #3 + #4 — Job cleanup lixeira + arquivos R2 orfaos
- [ ] A3 + #7..#10 — Integridade transacional Consulta Cartas
- [ ] A6 — Rate limit em resetPassword/exportCsv/exportData
- [ ] #12 #13 #23 — Validar MIME no sales.create
- [ ] A9 — Bateria de testes criticos
- [ ] A7 — Minimizacao LGPD em exportData

### Sprint 2 — Qualidade & Performance
- [ ] M8/M9 + #55 — Extrair formatters/userUtils
- [ ] A5 — Urgencia em SQL
- [ ] A10 + #24..#30 — Remover `as any` e endurecer tipagem
- [ ] M2..M6 — Pequenos bugs

### Sprint 3+ — Arquitetura
- [ ] A1/A2 + #41..#48 — Decompor db.ts, Vendas.tsx, consultationService
- [ ] A8 + #21/#22 — LGPD estrutural, retencao, purge
- [ ] #34 — Upload URL assinada
- [ ] M13 + #17 — Master password para bcrypt

---

Este documento consolida o pedido original e as duas auditorias tecnicas recebidas para o projeto `vendas`.

Objetivo de uso: validar os achados no codigo atual e corrigir por partes, priorizando seguranca, integridade de dados, LGPD, bugs de logica, tipagem, performance, arquitetura, testes e limpeza de codigo. Os textos das auditorias abaixo foram preservados como fonte bruta, sem reescrita.

## Texto original consolidado

```text
Vamos lá, eu pedi duas auditorias utilizando agentes e subagentes e IA's diferentes e opostas com a proposta de verificar bug e logica, tipagem, performance, arquitetura, testes e limpeza de código, honestamente não sei se temos erros parecidos ou completamente distintos, mas gostaria de corrigir eles por partes, seguindo a ordem certa para além de ter eficiência (e não perder tempo), não danificar o codigo.



cada uma dessas IA's utilizou esse fluxo de analise com os agentes e subagentes:

FLUXO DE EXECUÇÃO:



1. Cada subagente analisa o projeto inteiro separadamente

2. Cada subagente gera seu relatório estruturado

3. Um AGENTE COORDENADOR consolida tudo, removendo duplicações

4. O coordenador cria um diagnóstico geral



auditoria 1(acredito que essa IA tinha mais erros para comentar, mas seu output estorou provavelmente):



1. Visão honesta

O projeto está em estado saudável para um SaaS em produção. Tem fundações sólidas: strict: true, tRPC com RouterOutputs, soft delete, JWT com sessionVersion, rate limit de login, audit log, uploads com nanoid, cookie httpOnly/Secure/SameSite. Esforços recentes (M2/M3) limparam as any em todo o ADM.



Mas existem problemas reais — não apenas débito cosmético:



2 CRÍTICOS de produto/segurança que qualquer dia explodem: IDOR em endpoints da Consultora e cleanup automático da Lixeira não existe (o código existe, mas nada o chama em cron).

2 CRÍTICOS de postura: master password com fallback hardcoded e response.json() externo sem validação zod.

Um god file (server/db.ts, ~1.100 linhas) e páginas admin gigantes (Vendas.tsx com 2.657 linhas) que já começam a ser dolorosas de tocar.

Cobertura de testes existe mas tem lacunas perigosas — especialmente em deleteUser (sufixo _old, snapshot de sellerName, sessionVersion++), cleanupExpiredTrash e IDOR da consultora.

LGPD precisa de atenção: não há endpoints de direitos do titular, retenção de clients é indefinida, audit log registra ações mas não acessos a PII.

Performance no painel crítico (Consultora) tem duas pequenas gafes corrigíveis em 5 min (refetchOnMount: "always") que jogam fora cache e pioram a navegação em 3G.

Nenhum achado abaixo é especulativo sem base em código — todos vieram de leitura dos arquivos citados pelos subagentes.



2. Achados consolidados por severidade

Achados correlatos entre agentes foram fundidos. Fontes indicadas entre colchetes.



🔴 CRÍTICO

C1. IDOR — Consultora pode alterar status de trabalho de outras consultoras

Arquivos: server/routers/consultora.ts:304-342 (mutations markWritten, markDone, undoDone)

Problema: São consultoraProcedure (aceita consultora OU admin), mas o WHERE do UPDATE não filtra por sellerId = ctx.user.id. Qualquer consultora que descubra um id pode mudar o workStatus de vendas de outra consultora.

Por que importa: Exposição direta de dados e sabotagem trivial de fluxo de trabalho. Relatórios de produtividade ficam falsificáveis. [Segurança/Testes]

Como corrigir: Adicionar eq(sales.sellerId, ctx.user.id) (OU or(isAdmin, eq(sales.sellerId, ctx.user.id))) no where das três mutations. Criar teste cobrindo "consultora A não pode marcar venda de consultora B como feita".

Risco da correção: Baixíssimo — apenas restringe.

Prioridade: Agora.

Patch:



.where(

  and(

    eq(sales.id, input.id),

    eq(sales.workStatus, "para_escrever"),

    ctx.user.role === "admin" ? undefined : eq(sales.sellerId, ctx.user.id),

  )

)



C2. Limpeza automática da Lixeira (30 dias) não é executada

Arquivos: server/db.ts:680-715 (cleanupExpiredTrash), server/routers/sales.ts:1098 (endpoint manual), server/_core/index.ts (sem job agendado)

Problema: A função existe mas só roda quando um admin clica. Nenhum cron chama cleanupExpiredTrash() automaticamente. TODO.md promete "exclusão automática após 30 dias" — o contrato está quebrado.

Por que importa: Dados pessoais (nome, telefone, data de nascimento, fotos) ficam indefinidamente no Postgres e no R2 — violação direta de LGPD art. 15/16. Crescimento descontrolado do bucket free tier. [Bug & Lógica + LGPD + Testes]

Como corrigir: Criar server/jobs/cleanupJob.ts espelhando alertsJob.ts, chamar de server/_core/index.ts e só rodar em 1 instância (lock em Postgres). Também deletar arquivos órfãos do R2 (comprovantes/fotos dos sales deletados).

Risco da correção: Médio — deleção é irreversível. Rodar primeiro com dryRun: true logando contagem, depois ativar.

Prioridade: Agora.

Patch (esqueleto):



// server/jobs/cleanupJob.ts

export function startCleanupJob() {

  scheduleDaily(2, 0, async () => {

    try {

      const n = await cleanupExpiredTrash(30);

      console.log(`[CleanupJob] ${n} vendas expiradas removidas`);

    } catch (e) { console.error("[CleanupJob]", e); }

  });

}



C3. Master password com hash SHA256 hardcoded no código-fonte

Arquivos: server/routers/security.ts:18-20

Problema: MASTER_PASSWORD_HASH = process.env.MASTER_PASSWORD_HASH || "2259180d...". Fallback público. SHA256 é rápido (GPU brute-force trivial).

Por que importa: Quem vê o repositório vê o hash. Com SHA256 e dicionários modernos, senha comum é quebrada em minutos. Ataque permite desconectar qualquer sessão ativa. [Segurança]

Como corrigir: (1) remover o fallback — exigir MASTER_PASSWORD_HASH obrigatória, falhar no boot se ausente. (2) migrar para bcrypt.compare (já temos bcryptjs no package).

Risco da correção: Médio — Railway precisa ter a env var setada. Fazer em 2 passos: primeiro passar a exigir, depois trocar o algoritmo.

Prioridade: Agora.



C4. response.json() de API externa consumido sem validação

Arquivos: server/storage.ts:66, 88 (integração Manus)

Problema: const url = (await response.json()).url; — payload externo é unknown, mas tratado como { url: string } sem zod.

Por que importa: Se o provedor responder { error: "..." }, url vira undefined, grava-se no DB a URL inválida da venda (comprovante/foto), e o usuário só descobre no momento do download. [Tipagem]

Como corrigir: Criar const ManusResp = z.object({ url: z.string().url() }) e ManusResp.parse(await response.json()).

Risco da correção: Baixíssimo.

Prioridade: Agora.



🟠 ALTO

A1. Páginas admin gigantes (Vendas.tsx 2.657 linhas, Trabalhos.tsx 1.709 linhas) + sales.ts mutations enormes (create 268 linhas, update 588 linhas)

Arquivos: client/src/pages/admin/Vendas.tsx, admin/Trabalhos.tsx, server/routers/sales.ts:166-1067

Problema: 26 useState entrelaçados, modais inline, update() com 5+ níveis de aninhamento. [Arquitetura + Clean Code]

Por que importa: 80% das PRs passam aqui. Risco de regressão cresce linearmente com tamanho do arquivo. Type-check e rebuild estão ficando lentos.

Como corrigir: Decomposição gradual — extrair modais (SalesEditModal, SalesDetailsModal), hook useSalesQuery/useSalesFilters. No backend, extrair helpers privados em sales.ts (uploadAttachmentForSale, uploadClientPhotos, reserveConsultationSlot).

Risco: Médio — páginas são críticas. Fazer 1 extração por PR, validando em staging.

Prioridade: Próximos 2 sprints, gradual.



A2. server/db.ts — god file (~1.100 linhas, múltiplos domínios)

Arquivos: server/db.ts

Problema: Conexão + migrações + CRUD de users/products/clients/sales/sessions/audit/reports num arquivo só. [Arquitetura]

Por que importa: Mudar uma query comum (getSales, getTopSellers) mexe em arquivo usado por 14 procedures. Mock do DB em testes é tudo-ou-nada.

Como corrigir: Extrair para server/repositories/ (SalesRepository, UserRepository, etc.) e mover getDb, withRetry, ensureXxx para server/_core/db.ts e server/_core/migrations.ts. Refactor 1 domínio por PR.

Risco: Médio, mas reversível por repositório.

Prioridade: Próximos 3 sprints.



A3. Race condition + ausência de transação em Consulta Cartas

Arquivos: server/routers/sales.ts:314-416 (criação), server/db.ts:626-638 (deleteSale)

Problema: Venda criada → slot atualizado em duas queries separadas. Se a 2ª falhar, rollback é um db.delete() hard (fora do padrão soft delete). Dois cliques rápidos na criação geram venda órfã antes do rollback. [Bug & Lógica]

Por que importa: Inconsistência visível ao consultor ("slot livre" mas venda cadastrada) e hard delete de venda real.

Como corrigir: Envolver em db.transaction() (Drizzle v0.44 suporta). Rollback deve ser soft delete (setar deletedAt). Adicionar debounce/disabled no botão no cliente.

Risco: Médio — testar concorrência em staging.

Prioridade: Próximo sprint.



A4. refetchOnMount: "always" anulando staleTime no painel Consultora

Arquivos: client/src/pages/Consultora.tsx:1264-1282 (queries toWrite, pending, done, statusCounts)

Problema: Cada troca de aba → refetch mesmo com staleTime: 2min. Em 3G, custa 500ms-3s por aba. [Performance]

Por que importa: Painel é CRÍTICO (mobile, rede fraca) — regra do TODO.md.

Como corrigir: Remover refetchOnMount: "always" das 4 queries e confiar em staleTime. Se precisar de fresh data após mutation, usar invalidateQueries.

Risco: Nenhum.

Prioridade: Agora — 10 minutos.

Patch:



trpc.consultora.toWrite.useQuery(queryInput, {

  enabled: activeTab === "para_escrever",

  staleTime: 2 * 60 * 1000,

  // remover: refetchOnMount: "always",

});



A5. Cálculo de urgência em JS para 500 itens em cada request (consultora.toWrite/pending/alerts)

Arquivos: server/routers/consultora.ts:217-238, 511-568

Problema: Trazem .limit(500), iteram em JS chamando getSaleUrgency() (que faz loop em dias úteis com feriados BR) e ordenam em JS. 500 iterações pesadas por request. [Performance]

Por que importa: Painel mobile — 100-200ms extras em Node, e paginação está ausente (ver A11).

Como corrigir: Aplicar WHERE SQL para urgência real (data <= now - Nd), reduzir limit, e calcular urgency só nos itens que vão ser enviados. Possivelmente pré-computar urgencyScore como coluna generated.

Risco: Médio — exige entender a regra de getSaleUrgency profundamente antes de mover para SQL.

Prioridade: 2º sprint.



A6. Sem rate limit em resetPassword, sales.exportCsv, reports.exportData

Arquivos: server/routers/auth.ts, server/routers/sales.ts, server/routers/reports.ts

Problema: Apenas login tem rate limit. Admin comprometido ou abuso interno pode exportar milhares de registros ou resetar senhas em massa sem trava. [Segurança]

Por que importa: Exportação inclui PII de clientes — qualquer vazamento interno é catastrófico sob LGPD.

Como corrigir: Extrair RateLimiter reutilizável em server/_core/rateLimiter.ts. Aplicar:



resetPassword: 5/hora por admin

exportCsv/exportData: 10/hora por admin

Risco: Baixo.

Prioridade: Próximo sprint.

A7. exportData retorna todos os campos sem minimização LGPD

Arquivos: server/routers/reports.ts:86-111

Problema: Retorna getSales() raw — inclui clientPhone, clientBirthDate, notes. [LGPD]

Por que importa: Princípio da minimização (LGPD art. 6, III). Se o arquivo vazar, PII vaza junto.

Como corrigir: Aceitar fields: z.array(z.enum([...])) no input e projetar apenas os campos solicitados. Auditar cada exportação em auditLogs.

Risco: Baixo — backwards-compatible com default "all".

Prioridade: Próximo sprint.



A8. LGPD — direitos do titular, retenção de clients, audit de acesso a PII

Arquivos: drizzle/schema.ts:66-76 (clients), drizzle/schema.ts:211-223 (audit)

Problema:



Não há endpoint para cliente final exportar/excluir dados.

clients fica no DB para sempre (sem deletedAt/TTL).

Audit log registra ações (delete venda) mas não acessos (admin leu venda de X).

[LGPD]

Por que importa: LGPD art. 18 (direitos) e art. 15 (retenção). Auditoria fica cega a abusos internos.

Como corrigir: (1) router dataSubject com OTP por email; (2) adicionar lastUsedAt em clients + job de remoção após 2 anos; (3) helper logDataAccess disparado em reads de PII.

Risco: Médio — requer política clara de retenção.

Prioridade: Roadmap de LGPD — este trimestre.

A9. Testes ausentes em áreas de alto risco

Áreas sem cobertura adequada:



cleanupExpiredTrash (crítico — C2)

deleteUser: sufixo _old, sellerName snapshot, sessionVersion++

sessionVersion no JWT (invalida token pós-logout)

IDOR da consultora (ver C1)

reportsJob — zero testes

businessDays: Carnaval/Páscoa/Corpus Christi, virada de ano, DST

productCategory snapshot em sales

[Testes]

Como corrigir: Implementar em 2 fases (crítico/alto), inventariado pelo Testes Agent. ~5-6h de trabalho.

Prioridade: Paralelizar com correções críticas (cada fix crítico deve vir com seu teste).

A10. as any estratégicos ainda restantes (webpush.ts x7, reportsJob.ts, Trabalhos.tsx x5)

Arquivos: server/webpush.ts:32,43,51,75,79,97,115,119, server/jobs/reportsJob.ts:155, client/src/pages/admin/Trabalhos.tsx:164,887,1392,1400,1408

Problema: Queries Drizzle já são type-safe — os casts escondem. onError: (e: any) em mutations tRPC derrota type narrowing. [Tipagem]

Como corrigir: Remover casts (Drizzle infere sozinho); trocar handlers por showError já existente em client/src/lib/errors.ts.

Risco: Muito baixo — pode revelar bugs latentes (é o objetivo).

Prioridade: Próximo sprint.



A11. .limit(500) sem paginação nas queries da Consultora

Arquivos: server/routers/consultora.ts:150, 215, 282, 537

Problema: Consultora com >500 trabalhos vê apenas os 500 primeiros, sem aviso. [Performance/Bug]

Como corrigir: Paginação simples (offset/limit + hasMore) ou cursor.

Risco: Médio — quebra schema de resposta.

Prioridade: 2º-3º sprint.



🟡 MÉDIO

M1. Cookie de logout sem maxAge: 0 explícito — server/routers/auth.ts:250-251 [Segurança]

Mitigado por sessionVersion, mas cookie pode persistir. 1 linha de fix.



M2. Reativação de usuário — conflito de username silencioso — server/routers/auth.ts:373-403 [Bug]

Se o username original já foi retomado, admin não é avisado. Usuário reativado fica com joao_abc3.



M3. Vendedor inativo pode receber venda em edição — server/routers/sales.ts:559-598 [Bug]

Validação checa deletedAt, não active.



M4. upsertClient com erro engolido — server/routers/sales.ts:303-312 [Bug]

Venda é gravada sem clientId e ninguém avisa.



M5. Cálculo de "média diária do mês" usa day em vez de dias decorridos — server/routers/reports.ts:75-76 [Bug]

Dia 1 do mês inflaciona a média artificialmente. Validar semântica com stakeholder.



M6. Username sufixado com randomBytes(2) + fallback previsível Date.now() — server/routers/users.ts:405-444 [Bug]

Trocar fallback por randomUUID().slice(0, 8).



M7. Validação dupla/inconsistente de tamanho de arquivo — server/routers/sales.ts + shared/const.ts [Clean/Segurança]

Zod aceita 8MB de base64, runtime corta em 5MB. Usar MAX_FILE_BYTES uniformemente.



M8. formatCurrency duplicado em 5 páginas + formatDate vs toLocaleDateString inconsistente [Clean]

Extrair para client/src/lib/formatters.ts.



M9. Padrão userName = ctx.user.displayName || .name || .username || "Admin" duplicado 16 vezes [Clean]

Extrair getUserDisplayName(ctx.user) em server/_core/userUtils.ts.



M10. N+1 clientHistory — client/src/pages/Consultora.tsx:167-170, 661-664 [Performance]

Cada card expandido dispara query. Usar staleTime: 5min + gcTime: 10min.



M11. Jobs dentro do processo Express + sem lock distribuído [Arquitetura]

alertsJob/reportsJob duplicam execução com >1 dyno. ensureXxx também.



M12. Drizzle ensureXxx sem versionamento, sem lock, sem rollback [Arquitetura]

Implementar tabela migration_history + SELECT FOR UPDATE antes de aplicar.



M13. Master password SHA256 (deveria ser bcrypt) — server/routers/security.ts [Segurança]

Migrar após C3 resolvido.



M14. Cast + duck typing em server/storage.ts:52, 102-110 — sem type predicates [Tipagem]

Criar isAsyncIterable, hasArrayBuffer.



M15. Variáveis de módulo _s3Client: any — server/storage.ts:159-162 [Tipagem]

Importar tipos do @aws-sdk/client-s3 como type.



M16. Funções em server/db.ts (3) sem tipo de retorno explícito [Tipagem]

getUserByOpenId, getUserById, getProductById.



M17. Confusão entre shared/_core, server/_core, client/src/_core [Arquitetura]

Documentar regra: _core = infra sem conhecimento de domínio.



M18. Constantes de servidor em shared/const.ts (MAX_FILE_BYTES, ATTACHMENT_MIME_TYPES) [Arquitetura]

Mover server-only para server/config.ts.



M19. Timezone — comparação cutoff.toISOString() em cleanupExpiredTrash [Bug — HIPÓTESE]

Validar com teste. Usar DATE() no SQL para comparar só a data.



🟢 BAIXO

B1. Imports não usados em server/routers/sales.ts:25 (products, getProductById). [Clean]

B2. Helper local get = (type) => parts.find(...) — renomear para getPartValue. [Clean]

B3. Jobs sem handle para clearTimeout/clearInterval em graceful shutdown. [Performance]

B4. Alerts job silencioso quando array vazio — adicionar 1 console.log. [Bug]

B5. Comentário em inglês isolado em código PT-BR — sales.ts:182. [Clean]

B6. React Query default staleTime: 30s — pode subir para 2min sem prejuízo. [Performance]

B7. DashboardLayout.tsx 26KB — decompor em Sidebar/Header. [Arquitetura]

B8. Tipos inline em sales.ts:51-65 não compartilhados. [Tipagem/Arquitetura]

B9. Teste server/consultoraPhotoDownloadUrl.test.ts importa de client/src/lib/ — extrair helper para shared/. [Arquitetura]

B10. coverage não configurado em vitest.config.ts + não roda em CI. [Testes]

3. Plano de ação recomendado (ordem prática de execução)

🔥 Sprint 0 — "Fogo imediato" (1-2 dias, PRs pequenos)

Commit 1 — IDOR da consultora (C1)



server/routers/consultora.ts: 3 mutations ganham filtro sellerId.

Novo teste: consultora.markWritten.test.ts cobrindo "consultora A não mexe em venda de B".

Commit 2 — Master password sem fallback (C3, parte 1)



server/routers/security.ts: remover fallback SHA256, exigir env var.

Railway: garantir MASTER_PASSWORD_HASH setada em produção.

Commit 3 — Zod em payload Manus (C4)



server/storage.ts: ManusResp.parse(await response.json()) nas 2 chamadas.

Commit 4 — Remover refetchOnMount: "always" (A4)



client/src/pages/Consultora.tsx: 4 queries.

Manual QA: abrir abas no DevTools com throttling 3G, confirmar que não há refetch.

Commit 5 — Cookie logout com maxAge: 0 (M1)



server/routers/auth.ts: 1 linha.

🟠 Sprint 1 — Robustez (1 semana)

Commit 6 — Job de cleanup da Lixeira (C2)



server/jobs/cleanupJob.ts novo, agendado em _core/index.ts.

Modo dryRun via env var nas primeiras 48h em produção.

Também deletar arquivos R2 órfãos.

Teste de integração do cleanupExpiredTrash.

Commit 7 — Transação em criação/deleção de Consulta Cartas (A3)



db.transaction() em sales.create (caminho Consulta Cartas) e deleteSale.

Rollback muda de hard para soft delete.

Commit 8 — Rate limit em endpoints administrativos (A6)



Extrair RateLimiter genérico.

Aplicar em resetPassword, exportCsv, exportData.

Commit 9 — Bateria de testes críticos (A9)



deleteUser (sufixo _old, snapshot, sessionVersion++)

sessionVersion no JWT

cleanupExpiredTrash (30 dias, limite, lança slots)

reportsJob (pelo menos escapeHtml, formatCurrency, getReportPeriod)

Commit 10 — Minimização LGPD em exportData (A7)



Input ganha fields, default mantém backwards-compat.

Log em auditLogs com a lista de campos solicitados.

Commit 11 — Limpeza dos as any de baixo risco (A10)



webpush.ts, reportsJob.ts, handlers (e: any) em Trabalhos.tsx.

🟡 Sprint 2 — Qualidade e performance (1 semana)

Commit 12 — Extração de formatters



client/src/lib/formatters.ts (M8) — formatCurrency, formatDate, parseCurrencyToNumber.

server/_core/userUtils.ts (M9) — getUserDisplayName.

server/_core/timeutils.ts — getBrazilDateParts.

Commit 13 — Urgência em SQL (A5)



Mover cálculo de isOverdue/isUrgent para WHERE SQL em alerts/pending/toWrite.

Baixar .limit(500) após medir.

Commit 14 — businessDays edge cases



Testes para Carnaval, Páscoa, Corpus Christi, virada de ano, DST.

Commit 15 — Pequenos fixes



M2 (reativação username), M3 (vendedor ativo), M4 (upsertClient), M5 (média diária).

B1, B4, B5 (limpezas rápidas).

🧱 Sprint 3+ — Arquitetura (gradual, paralelo ao dia a dia)

Refactor gradual, uma PR pequena por vez:



Extrair UserRepository, depois SalesRepository, depois ReportRepository de server/db.ts (A2).

Decompor admin/Vendas.tsx em modais + hooks (A1).

Decompor update() em sales.ts em helpers privados (A1).

Migrations versionadas com tabela de histórico + lock (M12).

Documentar convenção _core (M17) e mover constantes server-only (M18).

Job queue real (Redis + BullMQ) quando precisar escalar >1 dyno (M11).

LGPD estrutural:



Router dataSubject (A8).

lastUsedAt + retenção em clients.

logDataAccess helper e aplicação nos reads de PII.

Migrar master password para bcrypt (M13).

4. Regras que segui (transparência)

Não inventei achados. Tudo abaixo foi extraído pelos 7 subagentes com arquivo e linha.

Marquei HIPÓTESE onde há incerteza (M19 — timezone na lixeira).

Não propus refactor grande sem justificar; todos os ALTOS têm caminho gradual.

Estilo puro (aspas, tabs, comentários triviais) foi filtrado — ficou só o que tem impacto real.

NÃO alterei nenhum arquivo — este é o plano para sua aprovação. Posso executar o Sprint 0 (5 commits curtos) quando você autorizar, respeitando TODO.md §1 (painéis Consultora/Vendedor intocáveis, alteração em Consultora.tsx no A4 é apenas config de query, sem mudança visual/funcional — ok para implementar, mas confirma se autoriza).

5. Próximo passo sugerido

Quer que eu comece pelo Sprint 0? Posso abrir os 5 commits separados (IDOR, master password, zod em Manus, refetchOnMount, cookie logout) na branch claude/code-review-subagents-zb1rc, cada um com teste quando aplicável. Avise se prefere priorizar outro item ou se há algo que queira discutir antes de implementar.



auditoria 2(essa IA preferiu escrever o relatorio em um arquivo para não estourar o output):



Revisao Tecnica Granular - Projeto vendas

Data: 2026-04-24

Escopo: backend, frontend, jobs, tipagem, seguranca, performance, arquitetura, testes

Validacoes executadas: pnpm run typecheck, pnpm run test, pnpm run build

Status desta etapa: nenhuma correcao aplicada; apenas inventario tecnico



Como ler este arquivo

Cada item abaixo e atomico. Eu removi apenas duplicacoes exatas. Problemas correlatos continuam separados quando afetam partes diferentes do sistema.



Marcadores de confianca:



Alta: evidenciado diretamente no codigo ou em comando executado

Media: evidenciado, mas depende de uma regra de negocio implicita

Hipotese: sinal forte, mas precisa validacao dirigida antes de corrigir

Contagem final desta versao:



57 achados tecnicos distintos

10 lacunas de teste importantes

Critico

1. auth.me expone a entidade User crua

Arquivos: server/routers.ts, server/_core/context.ts, drizzle/schema.ts

Origem: Seguranca + validacao local

Confianca: Alta

Problema: auth.me retorna ctx.user inteiro, e o tipo de usuario inclui passwordHash, openId e sessionVersion.

Por que importa: aumenta superficie de vazamento de credenciais derivadas e metadados internos sem necessidade funcional.

Como corrigir: retornar um DTO explicito de sessao, nunca a linha bruta da tabela.



2. Midias de venda sao servidas por URL publica direta

Arquivos: server/storage.ts, server/saleMedia.ts, server/routers/sales.ts, client/src/pages/admin/Vendas.tsx, client/src/pages/MinhasVendas.tsx

Origem: Seguranca + validacao local

Confianca: Alta

Problema: comprovantes e fotos sao persistidos com URL publica e consumidos diretamente no frontend.

Por que importa: se a URL vazar, o acesso ao arquivo foge do controle de autenticacao da aplicacao.

Como corrigir: persistir key interna e servir por rota autenticada ou URL assinada de curta duracao.



3. Exclusao permanente de venda nao remove objetos do storage

Arquivos: server/db.ts, server/storage.ts

Origem: Seguranca + validacao local

Confianca: Alta

Problema: permanentDeleteSale remove a venda do banco e libera slot, mas nao apaga os arquivos anexos no bucket.

Por que importa: o dado continua existente e potencialmente acessivel mesmo apos exclusao definitiva no sistema.

Como corrigir: resolver todas as chaves de midia da venda e chamar storageDelete antes do delete final.



4. cleanupExpiredTrash nao remove objetos do storage

Arquivos: server/db.ts, server/routers/sales.ts, server/storage.ts

Origem: Seguranca + validacao local

Confianca: Alta

Problema: a limpeza automatica da lixeira apaga linhas do banco, mas nao executa limpeza equivalente no storage.

Por que importa: cria acumulacao silenciosa de PII fora do banco e quebra expectativa de eliminacao definitiva.

Como corrigir: incluir cleanup de anexos e fotos no fluxo de cleanupExpiredTrash.



5. Ha risco forte de autorizacao horizontal quebrada para consultora

Arquivos: server/routers/consultora.ts, server/routers/consultationSlots.ts

Origem: Seguranca

Confianca: Hipotese

Problema: a regra observada e basicamente role === "consultora" || role === "admin", sem escopo explicito por carteira, responsavel, empresa ou ownership.

Por que importa: se existir mais de uma consultora, uma pode ler ou alterar itens da outra.

Como validar: criar dois usuarios consultora distintos e testar leitura e mutacao cruzadas.

Como corrigir: modelar ownership/assignment e aplicar filtros de escopo em todas as queries e mutations da area.



6. Login e unicidade de usuario usam criterios diferentes

Arquivos: server/routers/auth.ts

Origem: Bug & logica + Seguranca + validacao local

Confianca: Alta

Problema: login busca username e email com LOWER(...), mas criacao/edicao validam conflito com eq(...) case-sensitive.

Por que importa: joao e JOAO podem coexistir no banco e colidir no fluxo de login.

Como corrigir: normalizar para lowercase na persistencia e impor unicidade case-insensitive.



7. approveRefund nao libera o slot de consulta de forma consistente

Arquivos: server/routers/consultationSlots.ts

Origem: Bug & logica + validacao local

Confianca: Alta

Problema: o fluxo zera saleId e sold, mas preserva estado cancelado e nao reconstroi o slot como disponivel.

Por que importa: o horario pode ficar preso em estado morto, sem venda associada e sem voltar para o fluxo normal.

Como corrigir: aprovar reembolso deve restaurar integralmente o estado reutilizavel do slot.



8. restoreSale restaura a venda, mas nao restaura o slot de Consulta Cartas

Arquivos: server/db.ts, server/routers/sales.ts

Origem: Bug & logica + validacao local

Confianca: Alta

Problema: o restore remove deletedAt da venda, mas nao recompra nem reconcilia o slot associado.

Por que importa: a venda pode voltar ativa sem agenda valida.

Como corrigir: restore de venda de consulta deve ser transacional com restauracao do slot.



9. sales.update permite trocar para/de Consulta Cartas sem reconciliar slot

Arquivos: server/routers/sales.ts, client/src/pages/admin/Vendas.tsx

Origem: Bug & logica + validacao local

Confianca: Alta

Problema: o update administrativo altera productName e campos relacionados sem centralizar a integridade do slot.

Por que importa: o sistema aceita combinacoes invalidas, como venda consulta sem slot ou slot reservado para venda que deixou de ser consulta.

Como corrigir: mover essa regra para um caso de uso unico e transacional.



Alto

10. Uma venda que nao e Consulta Cartas ainda pode reservar consultationSlotId

Arquivos: server/routers/sales.ts

Origem: Bug & logica

Confianca: Alta

Problema: o backend exige slot quando o produto e Consulta Cartas, mas tambem tenta reservar slot sempre que consultationSlotId chega preenchido.

Por que importa: um produto comum pode consumir um horario de consulta por erro de cliente ou chamada maliciosa.

Como corrigir: recusar consultationSlotId quando productName !== "Consulta Cartas".



11. sales.create faz upload antes das ultimas validacoes de negocio

Arquivos: server/routers/sales.ts

Origem: Bug & logica

Confianca: Alta

Problema: anexos e fotos podem ser enviados para storage antes de todas as validacoes de slot, produto e regra de negocio terminarem.

Por que importa: falhas tardias geram arquivos orfaos.

Como corrigir: validar primeiro, subir depois, ou registrar cleanup compensatorio simetrico ao do update.



12. sales.create aceita MIME arbitrario para comprovante

Arquivos: server/routers/sales.ts, shared/const.ts

Origem: Bug & logica + Seguranca + Tipagem

Confianca: Alta

Problema: o create usa z.string() e nao reaplica a allowlist de ATTACHMENT_MIME_TYPES que existe no update.

Por que importa: qualquer content-type aceito pelo cliente pode parar no bucket.

Como corrigir: usar assertMime tambem no create.



13. sales.create aceita MIME arbitrario para fotos

Arquivos: server/routers/sales.ts, shared/const.ts

Origem: Bug & logica + Seguranca + Tipagem

Confianca: Alta

Problema: o create nao restringe photo1Mime e photo2Mime com a mesma allowlist do update.

Por que importa: aumenta risco de armazenamento de conteudo inadequado ou inesperado.

Como corrigir: validar contra PHOTO_MIME_TYPES antes do upload.



14. Restauracao de consulta pode manter metadados de reembolso incoerentes

Arquivos: server/routers/consultationSlots.ts, drizzle/schema.ts

Origem: Bug & logica

Confianca: Alta

Problema: o fluxo de restauracao limpa cancelamento, mas nao normaliza todos os campos de reembolso.

Por que importa: o slot pode voltar ativo carregando historico de refund que nao representa mais o estado atual.

Como corrigir: resetar refundStatus e campos relacionados quando o slot for restaurado para uso normal.



15. Criacao de slot provavelmente aceita horario ja passado no mesmo dia

Arquivos: server/routers/consultationSlots.ts

Origem: Bug & logica

Confianca: Media

Problema: a validacao checa data passada, mas nao foi encontrada validacao explicita para hora passada no dia corrente.

Por que importa: podem ser criados horarios inviaveis que ja expiraram no momento do cadastro.

Como validar: tentar criar um slot para hoje com horario anterior ao horario atual.

Como corrigir: comparar data+hora no timezone de negocio.



16. Existe hash padrao hardcoded para senha mestre

Arquivos: server/routers/security.ts

Origem: Seguranca + validacao local

Confianca: Alta

Problema: se MASTER_PASSWORD_HASH nao vier do ambiente, o codigo usa um hash fixo embutido.

Por que importa: o segredo deixa de ser segredo e passa a ser compartilhado entre ambientes.

Como corrigir: falhar o bootstrap quando a configuracao nao existir.



17. Verificacao da senha mestre usa SHA-256 simples

Arquivos: server/routers/security.ts

Origem: Seguranca

Confianca: Alta

Problema: a comparacao usa hash rapido, inadequado para segredo de alta sensibilidade.

Por que importa: reduz o custo de brute force caso o hash seja exposto.

Como corrigir: usar bcrypt/argon2 ou, melhor, reautenticacao do admin e segundo fator.



18. Fluxo OAuth nao usa state como protecao CSRF real

Arquivos: server/_core/sdk.ts, server/_core/oauth.ts

Origem: Seguranca + Tipagem + validacao local

Confianca: Alta

Problema: state e basicamente decodificado como redirect URI, sem vinculo forte com sessao/nonce do cliente.

Por que importa: abre espaco para callback replay ou redirecionamento indevido.

Como corrigir: gerar nonce assinado por sessao, persistir, validar no callback e expirar rapidamente.



19. Logs de autenticacao expõem username, id, role e IP em claro

Arquivos: server/routers/auth.ts

Origem: Seguranca + validacao local

Confianca: Alta

Problema: eventos de login escrevem identificadores e IP diretamente em console.

Por que importa: facilita vazamento de dados de acesso e enumeracao em agregadores de log.

Como corrigir: reduzir payload dos logs, mascarar campos e separar observabilidade de auditoria.



20. Push notifications expõem nomes de clientes e produtos na tela bloqueada

Arquivos: server/jobs/alertsJob.ts, server/webpush.ts, client/public/sw.js

Origem: Seguranca + LGPD + validacao local

Confianca: Alta

Problema: o corpo do push inclui cliente e produto em texto aberto.

Por que importa: qualquer pessoa com acesso fisico ao dispositivo pode ler dados operacionais sensiveis.

Como corrigir: enviar notificacao generica e exigir abertura autenticada do app para detalhes.



21. user_sessions nao tem politica explicita de purge

Arquivos: server/db.ts, drizzle/schema.ts, server/routers/security.ts

Origem: Seguranca + LGPD + validacao local

Confianca: Alta

Problema: ha leitura de sessoes ativas e exclusao pontual, mas nao rotina de limpeza de expiradas.

Por que importa: aumenta retencao desnecessaria de dados de acesso.

Como corrigir: criar job de purge por janela de retencao definida.



22. audit_logs nao tem politica explicita de purge

Arquivos: server/db.ts, drizzle/schema.ts, server/routers/security.ts

Origem: Seguranca + LGPD + validacao local

Confianca: Alta

Problema: o sistema grava e consulta logs, mas nao apresenta expiracao ou arquivamento controlado.

Por que importa: cresce indefinidamente e eleva risco LGPD em incidente futuro.

Como corrigir: definir retention e rotina de limpeza ou arquivamento.



23. O contentType gravado no storage e controlado pelo cliente

Arquivos: server/routers/sales.ts, server/storage.ts

Origem: Seguranca

Confianca: Alta

Problema: o upload propaga diretamente o MIME enviado pelo cliente para o storage.

Por que importa: mesmo sem executar arquivo, o bucket pode servir conteudo com tipo enganoso ou inesperado.

Como corrigir: validar MIME, derivar por allowlist e opcionalmente reidentificar pelo conteudo.



Medio

24. sales.create aceita datas externas como z.string()

Arquivos: server/routers/sales.ts

Origem: Tipagem + validacao local

Confianca: Alta

Problema: saleDate e clientBirthDate entram como string generica e depois sao convertidas com casts.

Por que importa: o TypeScript nao representa o contrato real e empurra erros para runtime.

Como corrigir: usar schema de data explicito e normalizar antes de persistir.



25. consultationSlots tambem usa datas como string com cast

Arquivos: server/routers/consultationSlots.ts

Origem: Tipagem + validacao local

Confianca: Alta

Problema: consultationDate e enviada/armazenada com as any.

Por que importa: a fronteira de input fica frouxa exatamente em um fluxo com forte regra temporal.

Como corrigir: validar formato, timezone e semanticamente data+hora.



26. sales.update termina em Record<string, unknown> + as any

Arquivos: server/routers/sales.ts

Origem: Tipagem + validacao local

Confianca: Alta

Problema: o objeto de update perde informacao de dominio e e forçado na chamada final.

Por que importa: mascara incompatibilidades entre o que o form aceita e o que o banco espera.

Como corrigir: trocar por tipo de comando explicito para update de venda.



27. Respostas externas do OAuth entram com (data as any)

Arquivos: server/_core/sdk.ts

Origem: Tipagem + validacao local

Confianca: Alta

Problema: dados de provedor externo sao espalhados e reinterpretados sem validacao de runtime.

Por que importa: altera o significado do tipo sem garantia de estrutura.

Como corrigir: validar resposta do provider com schema de runtime antes de mapear.



28. active_company e persistido como texto solto e recastado no app

Arquivos: server/db.ts, server/routers/settings.ts

Origem: Tipagem

Confianca: Alta

Problema: a configuracao de empresa ativa vive como string generica de key-value store.

Por que importa: valor invalido pode circular como se fosse membro legitimo do dominio.

Como corrigir: validar no write e no read contra enum/union fechada.



29. allowedCategories fica tipado como string[]

Arquivos: server/routers/products.ts, client/src/pages/admin/Produtos.tsx, client/src/pages/admin/Vendas.tsx

Origem: Tipagem + validacao local

Confianca: Alta

Problema: a lista de categorias perde a uniao de dominio e vira array generico de string em varios pontos.

Por que importa: o compilador deixa de proteger contra categoria invalida.

Como corrigir: usar union compartilhada e arrays readonly inferidos dela.



30. A tela admin de consultas usa any em fluxo relevante

Arquivos: client/src/pages/admin/Consultas.tsx

Origem: Tipagem + validacao local

Confianca: Alta

Problema: tabs, refunds e filtros ainda dependem de any.

Por que importa: a UI de um fluxo sensivel perde checks do compilador justamente onde ha estados multiplos.

Como corrigir: inferir tipos do router e definir modelos locais explicitos para tabs e refunds.



31. A tela Consultas dispara quatro queries em paralelo

Arquivos: client/src/pages/Consultas.tsx

Origem: Performance + validacao local

Confianca: Alta

Problema: listPending, listDone, listCancelled e listAll sao carregadas ao abrir a tela.

Por que importa: faz trabalho redundante de rede, banco e reconciliacao no cliente.

Como corrigir: buscar apenas a aba ativa ou usar uma query unificada parametrizada.



32. A tela admin de consultas repete o fan-out de quatro queries

Arquivos: client/src/pages/admin/Consultas.tsx

Origem: Performance + validacao local

Confianca: Alta

Problema: o painel administrativo repete a mesma estrategia de consultas paralelas.

Por que importa: o custo cresce duas vezes: na area do usuario e no admin.

Como corrigir: aplicar a mesma unificacao ou carga sob demanda.



33. O backend monta supersets e filtra em memoria para consultas

Arquivos: server/routers/consultationSlots.ts

Origem: Performance + validacao local

Confianca: Alta

Problema: varias listas fazem query ampla, calculam effectiveStatus em JS e so depois filtram.

Por que importa: transfere trabalho do SQL para Node e aumenta payload.

Como corrigir: empurrar filtros para SQL ou expor uma query parametrizada por status efetivo.



34. Uploads trafegam em base64 dentro de JSON

Arquivos: client/src/pages/NovaVenda.tsx, client/src/pages/admin/Vendas.tsx, server/routers/sales.ts

Origem: Performance + validacao local

Confianca: Alta

Problema: arquivos sao lidos no browser, inflados em base64 e enviados por payload JSON.

Por que importa: aumenta tamanho de rede, memoria e tempo de serializacao.

Como corrigir: usar upload direto com URL assinada ou multipart/form-data.



35. sales.myHistory nao tem paginacao

Arquivos: server/routers/sales.ts, client/src/pages/MinhasVendas.tsx

Origem: Performance + validacao local

Confianca: Alta

Problema: o historico do vendedor retorna tudo.

Por que importa: degrada com crescimento do volume e pressiona renderizacao da tela.

Como corrigir: adicionar paginacao ou cursor.



36. Filtro por categoria em admin/Vendas ocorre no cliente depois do limit

Arquivos: client/src/pages/admin/Vendas.tsx, server/routers/sales.ts

Origem: Performance + validacao local

Confianca: Alta

Problema: a query pede limit: 200 sem categoria e a pagina filtra depois.

Por que importa: pode esconder registros validos fora dos 200 primeiros e gera trabalho inutil.

Como corrigir: mover categoria para o backend.



37. O dashboard faz fan-out de agregacoes e consultas independentes

Arquivos: client/src/pages/admin/Dashboard.tsx, server/db.ts, server/routers/*.ts

Origem: Performance

Confianca: Media

Problema: ha varios cards e graficos dependentes de buscas separadas, algumas parcialmente sobrepostas.

Por que importa: aumenta latencia inicial e custo no banco.

Como validar: medir waterfall de queries no carregamento do dashboard.

Como corrigir: consolidar agregacoes e aplicar caching curto.



38. reportsJob carrega vendas do periodo e agrega tudo em memoria

Arquivos: server/jobs/reportsJob.ts

Origem: Performance + validacao local

Confianca: Alta

Problema: totais, top sellers e top produtos sao calculados a partir de um array completo em memoria.

Por que importa: escala mal em periodos longos ou operacao com mais volume.

Como corrigir: delegar agregacoes ao banco.



39. Jobs usam hora local do host em vez de timezone de negocio explicito

Arquivos: server/jobs/alertsJob.ts, server/jobs/reportsJob.ts

Origem: Bug & logica + Performance

Confianca: Media

Problema: comentarios e codigo usam new Date() e getHours() locais do servidor.

Por que importa: um deploy fora de Sao Paulo pode disparar alertas e relatorios no horario errado.

Como validar: rodar os jobs com timezone de host diferente e observar janelas de envio.

Como corrigir: centralizar timezone de negocio e converter explicitamente.



40. O build ja acusa chunks grandes

Arquivos: client/src/pages/admin/Relatorios.tsx, client/src/pages/admin/Vendas.tsx, client/src/pages/admin/Dashboard.tsx

Origem: Performance + observacao local

Confianca: Alta

Problema: pnpm run build concluiu com aviso de bundles grandes.

Por que importa: piora TTI, download inicial e cache churn.

Como corrigir: code-splitting mais agressivo, lazy load de exportadores e bibliotecas pesadas.



Baixo

41. server/db.ts virou modulo deus

Arquivos: server/db.ts

Origem: Arquitetura + validacao local

Confianca: Alta

Problema: o arquivo acumula acesso a dados, regras de negocio, lixeira, relatorios, sessoes e auditoria.

Por que importa: aumenta acoplamento e dificulta testes focados.

Como corrigir: fatiar por dominio e responsabilidade.



42. server/routers/sales.ts mistura API, workflow, storage e auditoria

Arquivos: server/routers/sales.ts

Origem: Arquitetura + validacao local

Confianca: Alta

Problema: o router concentra validacao, upload, integridade de consulta, audicao e restore.

Por que importa: qualquer mudanca simples tem alto raio de regressao.

Como corrigir: extrair casos de uso e servicos por fluxo.



43. client/src/pages/admin/Vendas.tsx esta grande demais

Arquivos: client/src/pages/admin/Vendas.tsx

Origem: Arquitetura + Clean code

Confianca: Alta

Problema: a pagina concentra filtros, modais, edicao, exportacao, upload e logica de consulta.

Por que importa: baixa legibilidade e dificulta manutencao incremental.

Como corrigir: separar por hooks e componentes de feature.



44. client/src/pages/NovaVenda.tsx esta grande demais

Arquivos: client/src/pages/NovaVenda.tsx

Origem: Arquitetura + Clean code

Confianca: Alta

Problema: o fluxo de cadastro mistura formulario, upload, regra de Consulta Cartas e montagem de payload.

Por que importa: erro pequeno no form exige navegar muito contexto.

Como corrigir: quebrar em sections, hooks de formulario e hook de upload.



45. client/src/pages/Consultora.tsx esta grande demais

Arquivos: client/src/pages/Consultora.tsx

Origem: Arquitetura + Clean code

Confianca: Alta

Problema: a tela mistura board, filtros, categoria, imagem e historico.

Por que importa: qualquer ajuste visual ou funcional fica caro.

Como corrigir: decompor por areas funcionais.



46. A regra de negocio de Consulta Cartas depende de string literal

Arquivos: server/db.ts, server/routers/sales.ts, server/routers/consultora.ts, client/src/pages/NovaVenda.tsx, client/src/pages/admin/Vendas.tsx

Origem: Arquitetura + validacao local

Confianca: Alta

Problema: varios fluxos comparam diretamente productName === "Consulta Cartas".

Por que importa: o nome do produto vira chave de comportamento critico.

Como corrigir: modelar capability ou tipo de produto de forma explicita.



47. Transicoes de workStatus estao espalhadas e duplicadas

Arquivos: server/routers/consultora.ts, client/src/pages/Consultora.tsx, client/src/pages/admin/Trabalhos.tsx

Origem: Arquitetura + Clean code

Confianca: Media

Problema: semantica de status e filtros relacionados aparecem repetidos em varios pontos.

Por que importa: alteracoes de fluxo tendem a ficar inconsistentes entre backend e UI.

Como corrigir: centralizar a maquina de estados ou helpers de transicao.



48. Ciclo de vida de slot esta distribuido entre camadas diferentes

Arquivos: server/db.ts, server/routers/sales.ts, server/routers/consultationSlots.ts, client/src/pages/admin/Vendas.tsx

Origem: Arquitetura + validacao local

Confianca: Alta

Problema: reserva, cancelamento, refund, restore e cleanup estao divididos entre modulos sem uma fronteira unica.

Por que importa: facilita inconsistencias como as dos itens criticos.

Como corrigir: criar um consultationService unico para integridade do slot.



49. Helpers de data e hora estao dispersos

Arquivos: server/jobs/alertsJob.ts, server/jobs/reportsJob.ts, client/src/pages/admin/Vendas.tsx, client/src/pages/NovaVenda.tsx, shared/*

Origem: Arquitetura

Confianca: Media

Problema: ha varias conversoes e formatacoes locais em vez de uma estrategia comum.

Por que importa: timezone e formato viram fonte recorrente de bug.

Como corrigir: centralizar utilitarios de data e timezone de negocio.



50. Jobs estao acoplados ao processo HTTP

Arquivos: server/jobs/alertsJob.ts, server/jobs/reportsJob.ts, server/_core/index.ts

Origem: Arquitetura

Confianca: Media

Problema: os jobs parecem nascer junto com o processo da aplicacao, sem separacao operacional clara.

Por que importa: dificulta escala horizontal, controle de concorrencia e testes.

Como corrigir: extrair para worker dedicado ou scheduler externo.



51. Logica de relatorios esta repartida entre camadas

Arquivos: server/db.ts, server/jobs/reportsJob.ts, client/src/pages/admin/Relatorios.tsx

Origem: Arquitetura

Confianca: Alta

Problema: ha conhecimento de periodo, agregacao e formato de relatorio em mais de um lugar.

Por que importa: regras divergem com facilidade.

Como corrigir: definir servico unico de dados de relatorio e presenters separados.



52. A regra de foto divergiu entre create e edit

Arquivos: server/routers/sales.ts, client/src/pages/admin/Vendas.tsx, client/src/pages/NovaVenda.tsx

Origem: Clean code + Bug & logica

Confianca: Alta

Problema: update tem mais validacoes e cleanup que create.

Por que importa: o sistema aceita comportamentos diferentes para o mesmo conceito dependendo da tela.

Como corrigir: compartilhar pipeline de validacao e upload.



53. O pipeline de upload esta duplicado e ja driftou

Arquivos: server/routers/sales.ts, client/src/pages/NovaVenda.tsx, client/src/pages/admin/Vendas.tsx

Origem: Clean code + validacao local

Confianca: Alta

Problema: leitura de arquivo, base64, mime, cleanup e limites aparecem repetidos.

Por que importa: correcoes entram num fluxo e ficam faltando no outro.

Como corrigir: extrair componentes/hook/utilitarios compartilhados.



54. Normalizacao de midia esta duplicada entre client e server

Arquivos: client/src/lib/saleMedia.ts, server/saleMedia.ts

Origem: Clean code

Confianca: Alta

Problema: DTOs e mapeamentos publicos existem em mais de um lugar.

Por que importa: uma mudanca de contrato pode quebrar silenciosamente o outro lado.

Como corrigir: mover tipos e shapes publicos para shared/.



55. Fallback de nome de usuario esta repetido em varios routers

Arquivos: server/routers/auth.ts, server/routers/consultationSlots.ts, server/routers/consultora.ts, server/routers/products.ts, server/routers/sales.ts, server/routers/security.ts, server/routers/users.ts

Origem: Clean code + validacao local

Confianca: Alta

Problema: a mesma logica displayName || name || username || ... aparece muitas vezes.

Por que importa: pequenas divergencias de apresentacao ou auditoria ficam espalhadas.

Como corrigir: centralizar getUserDisplayName.



56. DTOs publicos de midia estao redundantes entre camadas

Arquivos: server/saleMedia.ts, client/src/lib/saleMedia.ts, drizzle/schema.ts

Origem: Tipagem + Clean code

Confianca: Alta

Problema: a definicao publica do que e anexo/foto aparece espelhada.

Por que importa: dobra manutencao e aumenta risco de drift.

Como corrigir: extrair tipos publicos de midia para shared/.



57. O dominio de produto/categoria continua frouxo em varias bordas

Arquivos: client/src/pages/NovaVenda.tsx, client/src/pages/admin/Produtos.tsx, client/src/pages/admin/Vendas.tsx, server/routers/products.ts

Origem: Tipagem + Clean code

Confianca: Alta

Problema: categorias sao recastadas repetidamente com as e arrays manuais.

Por que importa: enfraquece o dominio e favorece regressao silenciosa.

Como corrigir: unificar enums/unions e evitar casts nas telas.



Lacunas de teste que hoje deixam bugs passarem

T1. Falta teste para orphan cleanup em sales.create

Arquivos: server/routers/sales.ts, server/sales.update-storage.test.ts

Confianca: Alta

Problema: existe cobertura boa do update com cleanup, mas nao do create.

Como cobrir: falhar depois do primeiro upload no create e verificar storageDelete.



T2. Falta teste para approveRefund realmente liberar slot

Arquivos: server/routers/consultationSlots.ts, server/consultationSlots.test.ts

Confianca: Alta

Problema: a suite nao protege a integridade final do slot apos aprovacao de refund.

Como cobrir: validar sold, saleId, status, cancelledAt, cancelReason e refundStatus.



T3. Falta teste para restore de venda de Consulta Cartas

Arquivos: server/db.ts, server/routers/sales.ts

Confianca: Alta

Problema: o bug de restore sem slot hoje nao parece coberto.

Como cobrir: deletar, restaurar e verificar consistencia slot+venda.



T4. Falta teste para troca de tipo em sales.update

Arquivos: server/routers/sales.ts

Confianca: Alta

Problema: nao ha teste protegendo transicao entre venda comum e Consulta Cartas.

Como cobrir: atualizar para consulta e sair de consulta, verificando reserva/liberacao de slot.



T5. Falta teste para rollback de reschedule em excecao inesperada

Arquivos: server/routers/consultationSlots.ts

Confianca: Alta

Problema: a suite nao garante rollback completo quando uma etapa intermediaria falha.

Como cobrir: simular falha apos liberar slot anterior e verificar atomicidade.



T6. Falta teste para ciclo de username com underscore em ativacao/desativacao

Arquivos: server/routers/auth.ts

Confianca: Alta

Problema: o fluxo de sufixo _XXXX e reativacao tem regras nao triviais e pouca protecao.

Como cobrir: criar casos com username original contendo underscore e com conflito no retorno.



T7. Falta teste para mutation de status da consultora que retorna sucesso sem alterar linha

Arquivos: server/routers/consultora.ts

Confianca: Media

Problema: o agente de testes sinalizou caminhos de sucesso sem garantia de row change efetivo.

Como cobrir: forcar filtros que nao batem em nenhuma linha e verificar erro ou no-op explicito.



T8. Falta teste para bordas temporais do status efetivo de consulta

Arquivos: server/routers/consultationSlots.ts

Confianca: Alta

Problema: effectiveStatus depende de tempo e tende a quebrar em borda.

Como cobrir: congelar relogio e testar transicoes entre pendente, realizada e cancelada.



T9. Falta teste para jobs sensiveis a timezone

Arquivos: server/jobs/alertsJob.ts, server/jobs/reportsJob.ts

Confianca: Media

Problema: nao ha protecao automatica para rodar em host com timezone diferente.

Como cobrir: simular timezone de host distinto e verificar janela de disparo.



T10. Fluxos criticos de frontend seguem sem cobertura

Arquivos: client/src/pages/NovaVenda.tsx, client/src/pages/admin/Consultas.tsx, client/src/pages/admin/Vendas.tsx, vitest.config.ts

Confianca: Alta

Problema: tela de nova venda, refunds e edicao admin concentram regras e nao estao protegidas por testes de interface/integracao.

Como cobrir: testes de formulario, upload, selecao de slot, refund e troca de produto.



Ordem pratica recomendada

Fechar superficie de vazamento: itens 1 a 4, 16 a 23.

Corrigir integridade de Consulta Cartas: itens 7 a 15.

Endurecer fronteiras de tipo e input: itens 24 a 30 e 57.

Cobrir bugs com testes antes de refatorar: T1 a T10.

Reduzir custo operacional: itens 31 a 40.

Atacar divida estrutural com refatoracao incremental: itens 41 a 56.
```