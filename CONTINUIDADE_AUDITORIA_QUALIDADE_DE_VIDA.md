# Continuidade da Auditoria de Qualidade de Vida

## 1. Finalidade

Este arquivo transfere a auditoria para outro chat. Registra o estado confirmado
em 29/07/2026 e reconfirmado em 01/08/2026 e 03/08/2026, decisões oficiais,
trabalho concluído, pendências, bloqueios e o procedimento de retomada.

Ele não concede autorização automática. Silêncio, troca de chat ou compactação
nunca significam aprovação. O sistema está em produção e a prioridade é
preservar estabilidade, dados, contratos, permissões, build e deploy.

## 2. Protocolo obrigatório no novo chat

Antes de analisar, sugerir ou alterar qualquer coisa:

1. Confirmar branch e worktree com comandos somente leitura.
2. Ler integralmente, nesta ordem:
   - `TODO.md` de `codex/qol-critical`;
   - `AUDITORIA_QUALIDADE_DE_VIDA.md`;
   - este `CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md`.
3. Se não estiver na branch correta, ler primeiro os arquivos com `git show`
   a partir de `origin/codex/qol-critical`.
4. Confirmar novamente todos os SHAs locais e remotos.
5. Buscar a `origin/main` atual antes de revisar ou planejar.
6. Comparar `main` local e `origin/main`. Antes de uma revisão/alteração
   aprovada, e somente com worktree seguro, atualizar a `main` por
   `git pull --ff-only origin main` e voltar à crítica. Se houver dirty state,
   divergência ou impossibilidade de fast-forward, parar e relatar; não
   resolver por merge/rebase automático.
7. Apresentar plano pré-alteração e aguardar aprovação explícita.

Inspeções recomendadas:

```powershell
git status --short --branch
git branch --show-current
git fetch origin main
git rev-parse main origin/main codex/qol-integration origin/codex/qol-integration codex/qol-critical origin/codex/qol-critical
git rev-list --left-right --count main...origin/main
git log --left-right --oneline origin/main...HEAD
git diff --stat origin/main...HEAD
```

Para escopo de branch divergente, usar `git diff origin/main...HEAD` (três
pontos), não `origin/main..HEAD`.

### Após qualquer compactação

A primeira ação obrigatória é reler integralmente
`AUDITORIA_QUALIDADE_DE_VIDA.md`. Depois, reler este documento e confirmar
`TODO.md`. Compactação não amplia escopo nem renova autorizações consumidas.

## 3. Arquivo protegido

`docs/REVISAO_TECNICA_GRANULAR_VENDAS.md` é não rastreado, pertence ao usuário
e não faz parte desta auditoria.

- Não abrir, ler ou usar como fonte.
- Não editar, mover, renomear ou apagar.
- Não adicionar ao stage ou a commits.
- Não incluir em formatação global.

`pnpm run format:check` usa `docs/**/*.md` e pode alcançá-lo. Usar Prettier
somente nos arquivos rastreados do escopo e `git diff --check`.
O arquivo não foi usado como fonte desta auditoria.

## 4. Fontes e conflitos conhecidos

`TODO.md` é a fonte permanente principal. Na branch crítica ele já contém as
decisões atualizadas sobre 90 dias, identidade de funcionários, data civil,
reembolsos e senha mestre.

`AUDITORIA_QUALIDADE_DE_VIDA.md` preserva decisões válidas, mas tem estados
históricos obsoletos: versões antigas dizem uma réplica, produção em `79660b6`,
nenhum deploy e gate anterior. Este arquivo substitui somente esses estados
operacionais.

O mapa de pastas de `TODO.md` ainda atribui o startup operacional, os três
`ensure*` e os jobs a `server/_core/index.ts`. Após S05-B, esse arquivo é apenas
o bootstrap/gate de configuração; o servidor operacional está em
`server/_core/server.ts`. A regra permanente não mudou, mas esse mapa deve ser
alinhado em uma autorização documental futura.

Se documento, código e decisão do usuário divergirem: registrar o conflito,
explicar impacto e pedir decisão. Nunca corrigir silenciosamente.

### DDL no startup

`TODO.md` ainda prescreve `ensureXxxColumns()`/`ALTER TABLE IF NOT EXISTS` no
startup e proíbe migration em pre-deploy. Com várias réplicas, isso é risco
concorrente. H1 não alterou esse padrão. Qualquer proposta de mudança deve
apontar o conflito, mostrar compatibilidade/rollback e obter decisão oficial.

## 5. Regras permanentes

- Não trabalhar diretamente na `main` para novas mudanças.
- Não fazer merge, push ou deploy na `main` sem permissão explícita nova.
- As autorizações do hotfix H1 e do inventário B01 já foram consumidas.
- A autorização inicial do registro B01 sem commit foi consumida; autorização
  posterior específica permitiu o commit local `8d4ea4e`, sem push.
- As autorizações de S05-A, da implementação/revisão local de S05-B, da
  ampliação do `AGENTS.md` e dos respectivos commits/checkpoints locais foram
  consumidas. Elas não autorizam validação/rotação externa, push ou deploy.
- Commits, pushes e merges futuros, inclusive em branches de trabalho, exigem
  confirmação específica.
- A regra de manter branches no GitHub não autoriza pushes indiscriminados.
- Não usar rebase ou force-push nesta auditoria.
- Manter no GitHub somente trabalho explicitamente aprovado e validado.
- Não misturar itens sem relação; preferir commits por item.
- Não alterar GitHub, Railway, PostgreSQL ou R2 sem autorização específica.
- Poder usar o navegador não é autorização permanente de escopo; cada
  inventário externo segue seu próprio gate.
- B01 foi concluído, mas qualquer DDL, schema, migration ou reconciliação do
  ledger continua bloqueada até backup recente, restauração, plano idempotente
  de compatibilidade e aprovação. DDL destrutiva permanece proibida.
- Purge real e deleção de mídia também permanecem bloqueados.
- Não editar migrations antigas às cegas.
- Não alterar negócio, contratos, papéis, permissões ou sessões por suposição.
- Antes de cada grande etapa: plano, impacto, riscos, testes e rollback;
  aguardar confirmação.
- Depois: revisar diff, testar, buildar e relatar o que foi ou não validado.

## 6. Regra de percentuais

Toda atualização deve informar `X% concluído / Y% restante`, somando 100%. Usar
a tarefa ativa e, quando útil, o plano global. O percentual global é estimativa
gerencial de escopo/risco, não contagem de commits.

Estado deste handoff:

- H1: **100% / 0%**.
- C1 (`S01` e `S02`): **100% / 0%**.
- Sincronização: **100% / 0%**.
- B01: **100% / 0%**.
- S05-A: **100% / 0%**.
- S05-B local: **100% / 0%**.
- Gate operacional S05 (ambientes/rotação/rollout): **0% / 100%**.
- Plano global estimado revisado: **20% / 80%**.

## 7. Estado Git confirmado

Commit-base: `79660b694925a33dbb077631648d7aef64a3591a`.
Branch de auditoria `codex/qol-audit-20260729`: o mesmo commit-base.

Main/hotfix em produção:

- `main` e `origin/main`: `d92ede38bca1dcc1319fee834f958c3de9676954`,
  reconfirmados após `git fetch origin main` em 03/08/2026.
- `codex/qol-hotfix-multi-replica` e
  `origin/codex/qol-hotfix-multi-replica`: o mesmo SHA.

Integração:

- merge do hotfix: `34582eb34152818a2b18c303f2837f2e694a0be5`;
- versão combinada `2.16.2`:
  `ea53d5b5b5118f8be8dd6b9c8d4ffda12d7f73e6`;
- local e remoto estavam nesse SHA após o push.

Crítica:

- regra de compactação: `8a8c91a495edcb43bf8f31cf9fe45b9d97af3bad`;
- merge da integração:
  `c091b0dab5e378f29db81d274b11ae8ca31cea3d`;
- normalização documental:
  `473da91ed14541e1342680378a8d55b47660bc38`;
- continuidade original:
  `0f2642a4725cdcf643c3f5ac86d913908b715e75`;
- o remoto crítico permanece em
  `0f2642a4725cdcf643c3f5ac86d913908b715e75`;
- commits locais posteriores ao remoto:
  - `8d4ea4e4c317323d423f5dc0ccb94e205dfbdac4` — registro B01;
  - `df10c8c02f829348600c4fe615c6fb63963bd8cf` — `AGENTS.md`;
  - `4e0be94f2418848136cc31a851074a9924d7a54c` — testes S05-A;
  - `e2f85d9fc9595741eb9f585fa9efc97a94ee5e35` — checkpoint S05-A;
  - `96fecd665c6ed9b412831a8f4fd9dc6d841c1fea` — julgamento crítico em
    `AGENTS.md`;
  - `cee9b7708de79ed814fb8e16bb79898fbc8c9dd7` — implementação/testes S05-B;
  - `2cffb03c990e1de1e2ee4d5fb7c16f1a8af1853b` — versão `2.16.3`.

Branch atual confirmada: `codex/qol-critical`.
Este próprio registro documental foi autorizado para commit local; consultar
`HEAD` para o SHA resultante. O arquivo protegido permanece não rastreado,
intacto e fora do stage. Nenhum push foi executado.

## 8. Fluxo de branches

1. `codex/qol-integration`: acumula o revisado/aprovado.
2. `codex/qol-critical`: branch atual dos críticos, descendente da integração.
3. `codex/qol-high`: criar só após críticos integrados e nova autorização.
4. `codex/qol-medium`: criar depois dos altos.
5. `codex/qol-low`: criar por último.

Depois de críticos concluídos e aprovados, a intenção é avançar a integração
até a crítica, por fast-forward quando possível, e só então criar a branch dos
altos. Nada disso autoriza tocar na `main`.

## 9. Mapa resumido

Frontend: React, Vite, Tailwind, shadcn/Radix, tRPC e React Query. Vendedor usa
Nova Venda e vendas do mês; Consultora usa Trabalhos, Nova Venda, Minhas Vendas
e Consultas; ADM usa Dashboard, Cadastros, Vendas, Relatórios, Produtos,
Trabalhos, Consultas, Alertas, Funcionários, Lixeira, Segurança e Configurações.

Backend: Express/tRPC; procedures públicas, autenticadas e administrativas;
JWT/cookie, `sessionVersion` e sessões persistidas; serviços de vendas,
clientes, produtos, consultas, relatórios, push, segurança e configurações.

Dados: PostgreSQL/Drizzle e Cloudflare R2/S3. Vendas usam soft delete. B01
confirmou 10 tabelas, 113 colunas e 7 enums em produção. Todas as estruturas
esperadas pelo schema existem, mas `audit_logs.userName`, `action` e
`ipAddress` usam `text` em produção versus `varchar` no código. A FK
`audit_logs.userId -> users.id ON DELETE SET NULL` existe somente em produção.
A origem física de `user_sessions` e `audit_logs` continua não comprovada e o
ledger de migrations está vazio.

Operação: Railway US East/Virginia, duas réplicas observadas em 29/07/2026,
`TZ=America/Sao_Paulo`, healthcheck `/api/health` e deploy automático da
`main`. GitHub continuava sem proteção conhecida da `main`.

## 10. Fluxos sensíveis

Não reorganizar sem autorização:

`Nova Venda -> Consultora -> preenchimento -> Pendente -> Feito`

Também são sensíveis: sessões/desconexão, desativação/reativação, papéis,
permissões, restauração forçada, purge, reembolso, status, reatribuição e
mudanças visíveis nos painéis de funcionários.

Como os funcionários têm baixa familiaridade técnica, qualquer possível
desconexão exige motivo, pessoas afetadas, janela, necessidade de novo login,
rollback e comunicação prévia.

## 11. Trabalho concluído

### 11.1 Auditoria inicial

- Mapa de arquitetura, módulos e fluxos concluído.
- Conclusões consolidadas em `AUDITORIA_QUALIDADE_DE_VIDA.md`.
- Branches de auditoria, integração e crítica criadas.
- `TODO.md` da branch crítica alinhado às decisões oficiais.

Foi autorizada e executada a remoção somente de:

- `Iniciar Solo Leveling Otimizado.cmd`;
- `iniciar-solo-leveling-otimizado.ps1`;
- `LEIA-ME - Solo Leveling otimizado.txt`.

Nenhum outro untracked pode ser removido sem autorização.

### 11.2 C1/S01 — contrato público de `auth.me`

Commit `1df743e`:

- sem login, continua retornando `null`;
- com login, retorna somente `role`, `name`, `email` e `username`;
- usuário completo permanece apenas no contexto interno;
- `passwordHash`, `sessionVersion`, IDs e demais campos internos não saem por
  esse contrato.

Teste: `server/auth.me.test.ts`.

### 11.3 C1/S02 — chaves privadas de mídia

Commit `95924ca`:

- `reports.exportData` e `sales.listDeleted` preservam wrappers/dados públicos;
- vendas passam por `toPublicSale`;
- não expõem `attachmentKey`, `photo1Key`, `photo2Key`, `attachmentExtras` ou
  `photoExtras` internos;
- URLs e coleções públicas necessárias permanecem.

Teste: `server/sales.public-media.test.ts`.

Versionamento C1: `11d2243` (`2.16.1`). Documentação: `8e550fe` e `206b8d5`.
C1 está concluída e validada na branch crítica, mas **não está em produção**.
Não afirmar validação manual em produção.

### 11.4 Achado relacionado fora do escopo

`users.listAll` e `users.getById` ainda expõem campos internos:

- `openId` em ambas;
- `deletedAt` e `sessionVersion` em `getById`.

Não expõem `passwordHash`. Reduzir esses contratos é item separado e exige
proposta/aprovação próprias.

### 11.5 H1 — coordenação entre réplicas

Commit `d92ede3`. Implementado:

- PostgreSQL advisory lock de sessão em conexão dedicada;
- só o líder inicia alertas/relatórios;
- heartbeat/timeouts e perda de liderança;
- follower com retry, backoff e jitter;
- timers singleton e cleanup idempotente;
- starters tardios limpos antes de nova liderança;
- relatório Resend idempotente por agendamento e data civil de São Paulo.

Não alterou schema/DDL, rotas, payloads, audiências, papéis, permissões,
sessões, período de relatórios ou fluxo principal de vendas.

O hotfix foi fast-forwarded para `main` e enviado com autorização explícita.
Observação pontual de produção em 29/07/2026:

- Railway: deploy bem-sucedido em `d92ede38bca1dcc1319fee834f958c3de9676954`;
- Vendas: 2/2 réplicas ativas;
- `/api/health`: `status: ok`;
- uma réplica líder iniciou jobs e outra ficou follower;
- sem erro inicial de liderança.

É um retrato pontual, não garantia permanente.

### 11.6 Sincronização pós-hotfix

- `main` mesclada na integração sem conflito/rebase.
- Versão combinada `2.16.2` em `ea53d5b`.
- Integração enviada ao GitHub.
- Integração mesclada na crítica sem conflito/rebase.
- Crítica enviada ao GitHub.
- Nenhum force-push e nenhum novo toque na `main`.

### 11.7 B01 — inventário estrutural somente leitura

B01 foi autorizado e concluído em 29/07/2026:

- PostgreSQL `18.4`, timezone do servidor `Etc/UTC`;
- `public` possui 10 tabelas, 113 colunas, 10 sequences e 7 enums;
- todas as tabelas e colunas esperadas pelo schema atual existem;
- há 13 índices, sendo 10 PKs e 3 uniques;
- não há views, foreign tables, triggers de aplicação, RLS ou policies;
- `drizzle.__drizzle_migrations` existe, mas contém zero registros;
- `audit_logs.userName`, `action` e `ipAddress` usam `text` em produção versus
  `varchar(256)`, `varchar(128)` e `varchar(64)` no schema;
- a FK `audit_logs.userId -> users.id ON DELETE SET NULL` existe somente em
  produção;
- o último snapshot cobre 8 tabelas e 89 colunas;
- `0000` diverge do próprio snapshot e `0001` repete três colunas sem
  idempotência;
- `0002` e `0003` não possuem snapshots e têm timestamps anteriores no
  journal;
- o migrador Railway aplica apenas `0000`, sem transação ou ledger;
- `monthlyGoal`, `attachmentExtras` e `photoExtras` dependem de `ensure*` no
  startup;
- `user_sessions` e `audit_logs` entraram no código em `b61b1c1`, sem DDL
  rastreado; a criação física continua não comprovada.

A sessão usou duas barreiras read-only, `REPEATABLE READ`,
`search_path=pg_catalog`, timeouts e encerramento por `ROLLBACK`. Nenhum dado de
negócio, DDL, DML, migration, alteração externa ou segredo foi registrado. A
credencial foi descartada após a desconexão.

Não executar `pnpm db:push`, `drizzle-kit migrate` ou
`scripts/migrate-railway.mjs` em produção no estado atual. Nenhuma correção do
schema, tipos, FK, snapshots ou ledger foi autorizada.

### 11.8 Arquivos principais dos itens concluídos

- S01: `server/routers.ts` e `server/auth.me.test.ts`.
- S02: `server/routers/reports.ts`, `server/routers/sales.ts`,
  `server/saleMedia.ts` e `server/sales.public-media.test.ts`.
- H1: `server/jobs/jobLeadership.ts`, `server/jobs/alertsJob.ts`,
  `server/jobs/reportsJob.ts`, `server/db.ts`, `server/email.ts` e
  `server/_core/server.ts` (código operacional movido por S05-B).
- Testes H1: `server/jobs/jobLeadership.test.ts`, jobs, advisory lock e email.
- S05-A: `server/security.disconnect.test.ts`.
- S05-B: `server/masterPassword.ts`, `server/_core/startup.ts`,
  `server/_core/server.ts`, `server/routers/security.ts` e
  `vitest.config.ts`.
- Testes S05-B: `server/masterPassword.test.ts` e
  `server/_core/startup.test.ts`.

### 11.9 S05-A — caracterização de senha mestre e sessões

S05-A foi autorizado e concluído localmente em 01/08/2026:

- 13 testes sintéticos cobrem `disconnectSession` e `disconnectUser`, com o
  módulo de banco integralmente mockado;
- anônimo, não administrador e senha incorreta são bloqueados antes de efeitos;
- `disconnectSession` seleciona o ID solicitado, pede incremento global de
  `sessionVersion` para o usuário-alvo, exclui somente a linha indicada e
  audita; sessão desconhecida ainda retorna sucesso;
- `disconnectUser` não confirma existência do alvo, pede incremento global,
  exclui todas as sessões do ID e audita;
- se o `getDb()` do router retornar `null`, ambos chamam os helpers de
  exclusão/auditoria e reportam sucesso sem incremento; esses helpers consultam
  `getDb()` novamente e podem também virar no-op se a indisponibilidade
  persistir;
- falhas de update, exclusão e auditoria confirmam uma sequência não
  transacional e são propagadas no ponto correspondente;
- payloads de auditoria são exatos e não contêm senha/hash sintéticos;
- revogação realmente individual não existe: o JWT não identifica a sessão e
  a autenticação não consulta `user_sessions`;
- o fallback permanece em produção e a credencial histórica associada deve ser
  considerada comprometida e rotacionada antes do rollout/deploy de
  S05-B;
- a env de produção não foi revalidada externamente durante S05-A;
- commit local do teste:
  `4e0be94f2418848136cc31a851074a9924d7a54c`;
- nenhum código de produção, configuração, sessão real, banco, segredo ou
  serviço externo foi alterado.

### 11.10 S05-B — configuração obrigatória e fail-fast

S05-B foi concluído localmente entre 01/08/2026 e 03/08/2026:

- o fallback rastreado foi removido;
- `MASTER_PASSWORD_HASH` passou a exigir exatamente 64 caracteres
  hexadecimais e a ser decodificado para 32 bytes antes de `timingSafeEqual`;
- senha e hash não são registrados;
- o bootstrap valida a configuração antes de importar routers, iniciar o timer
  do rate limiter, sondar porta, executar DDL de startup, abrir listener ou
  iniciar jobs;
- testes/CI usam somente fixture sintética calculada;
- a semântica caracterizada de `disconnectSession` e `disconnectUser` foi
  preservada;
- um bloqueador de ordem dos imports foi encontrado na revisão e corrigido com
  carregamento dinâmico testável;
- implementação/testes: commit local
  `cee9b7708de79ed814fb8e16bb79898fbc8c9dd7`;
- versão `2.16.3`: commit local
  `2cffb03c990e1de1e2ee4d5fb7c16f1a8af1853b`;
- nenhum segredo, sessão, banco ou serviço externo foi acessado ou alterado;
- nenhum push ou deploy foi executado.

## 12. Validações executadas

C1 original:

- typecheck;
- 24 arquivos/186 testes backend;
- build;
- Prettier de escopo;
- `git diff --check`.

H1 original:

- typecheck;
- 26 arquivos/205 testes backend;
- build;
- Prettier de escopo e diff-check;
- três revisões independentes sem bloqueador final.

Após sincronização, tanto integração quanto crítica passaram em:

- `pnpm run typecheck`;
- `pnpm run test:backend`: 28 arquivos/210 testes;
- `pnpm run build`;
- Prettier direcionado aos arquivos rastreados;
- `git diff --check`;
- checagem de ancestralidade.

A primeira tentativa de testes/build no sandbox falhou com `spawn EPERM`; foi
repetida com permissão administrativa e passou. Era limitação ambiental.

B01:

- `default_transaction_read_only=on` e `transaction_read_only=on`;
- isolamento `REPEATABLE READ`, `search_path=pg_catalog` e timeouts curtos;
- ledger validado como tabela PostgreSQL comum, persistente, sem RLS, regras,
  partições ou herança antes da leitura dos três campos permitidos;
- consultas limitadas a metadados estruturais e ao ledger vazio;
- encerramento com `ROLLBACK`, desconexão e descarte da credencial;
- worktree e SHAs reconfirmados após o inventário.

S05-A:

- teste direcionado: 1 arquivo/13 testes;
- `pnpm run typecheck`;
- `pnpm run test:backend`: 29 arquivos/223 testes;
- `pnpm run build`;
- Prettier direcionado, whitespace e revisão independente sem bloqueadores;
- nenhum banco, sessão ou serviço externo foi usado.

S05-B:

- testes direcionados: 3 arquivos/28 testes;
- `pnpm run typecheck`;
- `pnpm run test:backend`: 31 arquivos/238 testes;
- `pnpm run build`;
- Prettier direcionado, diff-check, whitespace/EOL e busca restrita por
  fallback/segredo;
- smoke do bundle inválido: saída 1, erro seguro e valor sentinela ausente;
- três revisões independentes sem bloqueador final;
- nenhum ambiente, segredo ou sessão real foi usado.

As validações de B01 acima são do inventário, não testes funcionais da aplicação.
Avisos conhecidos:

- chunk `exports` acima de 500 kB, preexistente;
- sem `RESEND_API_KEY`, testes informam email desabilitado, esperado;
- checkout Windows/CRLF torna inadequado o Prettier global neste worktree;
  usar checagem direcionada e nunca incluir o arquivo protegido.

## 13. Riscos residuais do H1

- Job já iniciado pode sobrepor brevemente novo líder durante failover.
- Email tem mitigação Resend; push não possui ledger idempotente durável.
- Não houve teste real automatizado com múltiplos processos/PostgreSQL de
  produção.
- Alertas perto de 8h/18h dependem de scheduling em memória.
- Não há ledger durável por ocorrência de alerta.
- Não há tratamento explícito de `SIGTERM`/`SIGINT`.
- `scripts/start.mjs` usa `shell: true`.
- Rotinas `ensure*`/DDL ainda executam em cada réplica.

São dívidas separadas. Não ampliar H1 silenciosamente.

## 14. Decisões oficiais

### 14.1 C01 — identidade de funcionários

Não interpretar/remover `_old`, hexadecimal ou outro sufixo. A proposta deve:

- armazenar identidade original explicitamente;
- preservar ID, histórico e vendas antigas;
- liberar o username original;
- tratar underscores, múltiplas desativações e colisões;
- tratar usuários legados já com `_old`/hexadecimal;
- tratar reativação quando o original estiver ocupado;
- invalidar somente sessões do funcionário afetado;
- nunca renomear/desconectar indevidamente o ocupante atual.

Antes: inventário de usuários antigos e modelo de compatibilidade. Se houver
coluna nova, depende dos achados de B01, reconciliação idempotente, gates de
backup/restauração e aprovação específica.

### 14.2 E01/E02 — lixeira e slots

Retenção correta: **90 dias civis de `America/Sao_Paulo`**, não 30.

Consulta Cartas na lixeira:

- fica oculta das telas operacionais;
- mantém o slot reservado durante os 90 dias;
- slot não pode ser revendido;
- restauração comum recupera o mesmo slot;
- slot só é liberado por cancelamento/reembolso confirmado, exclusão
  permanente ou purge após 90 dias.

Para inconsistência legada com slot ocupado, ADM escolhe outro slot livre. Se
cancelar, venda permanece na lixeira. Não criar `aguardando_reagendamento` e
nunca permitir duas vendas ativas no mesmo slot.

A escolha manual de outro slot pelo ADM deve exigir confirmação clara e gerar
audit log. O sistema deve preservar o vínculo/histórico do slot original e
explicar o estado final; não pode apenas ignorar o conflito. Liberar ou vender o
slot após cancelamento/reembolso/purge nunca apaga a relação histórica da venda
com o horário original.

O instante exato de elegibilidade aos 90 dias ainda precisa ser desenhado e
testado como aritmética de **data civil de São Paulo**, não como `90 * 24` horas
em UTC. Incluir viradas de dia, mês e ano e não inventar o boundary durante a
implementação.

### 14.3 Purge

Começa exclusivamente em dry-run, com quantidades, IDs, mídias, vínculos com
consultas/clientes/reembolsos, audit log, proteção contra duplicidade e
repetição segura. Nenhuma deleção real até revisão e nova confirmação.

### 14.4 Cliente canônico

Objetivo: um cliente por identidade e histórico. Não implementar deduplicação
automática em E01. Proposta separada deve cobrir duplicados, campos confiáveis,
homônimos, telefones normalizados, merge sem perder vendas, desfazer merge e
auditoria.

### 14.5 Reembolsos como extrato

Preservar venda, cliente, valor, item/consulta, responsável, motivo, timestamp,
estado anterior e posterior. Aprovação não apaga vínculo original. Estrutura de
eventos/ledger exige modelo e aprovação prévios.

### 14.6 F03 — data civil

- Instantes técnicos continuam em UTC.
- “Hoje”, dias e início/fim de mês usam `America/Sao_Paulo`.
- Frontend/backend devem concordar.
- Não usar `toISOString().slice(0, 10)` para data civil.
- Testar viradas de dia, mês e ano.
- Escopo de F03: somente essa correção.

### 14.7 Painéis protegidos

- F05: Consultora já recebe push; corrigir só o destino para rota/aba já
  autorizada. Não criar novo público.
- C02: unificar interpretação frontend/backend sem novas validações, regras
  mais restritivas ou mudança de negócio.
- C03: apenas texto `Vendas do mês atual`; preservar período, dados e receita.
- U01: distinguir loading, erro, vazio, cache e falha de atualização sem mudar
  permissão/período.
- U02: impedir duplo envio e mostrar falha de leitura sem mudar fluxo/contrato
  de Nova Venda.
- U03: foco, teclado, labels, nomes acessíveis, leitor de tela, restauração de
  foco e Escape; sem mudar sequência, aparência principal ou lógica.
- P01: carregamento/separação mantendo aparência e comportamento; validar todos
  os papéis e mobile.
- P02: demanda/paginação sem ampliar permissão, período, receita ou informação.
- P03: preview por Object URL, mesmo formato/validação/contrato, revogando URLs.

Esses limites permitem planejamento e futura execução, mas cada grande etapa
continua exigindo plano prévio.

### 14.8 F02 — Todas as vendas

Totais, contagens e exportações do ADM abrangem todo o conjunto filtrado, não só
a página. Antes de mudar, inventariar:

- filtros do frontend;
- filtros enviados ao backend;
- filtros apenas locais;
- sobreposições;
- defeitos;
- filtros úteis ausentes.

Preservar entrada manual de datas. Propor mês atual, mês anterior, ano atual,
seleção rápida de mês/ano. Não remover funcionalidade sem autorização.

## 15. Infraestrutura externa

Railway, retrato de 29/07/2026:

- duas réplicas de Vendas;
- US East/Virginia;
- `TZ=America/Sao_Paulo`;
- healthcheck `/api/health`, timeout 300 s;
- deploy automático da `main`.

Não depender de exatamente duas réplicas.

GitHub, último estado informado:

- `main` sem proteção;
- PR e Verify não obrigatórios;
- sem required checks;
- push direto/bypass permitidos;
- force-push e exclusão não bloqueados.

Recomendação futura, não aplicar automaticamente: proteger `main`, exigir PR e
Verify, bloquear force-push/exclusão, definir deploy seguro, readiness,
liveness e rollback.

O escopo conhecido de E04, B02, B03 e B05 aqui é produzir as recomendações
desta seção. Se títulos/limites adicionais forem necessários, perguntar ao
usuário; não procurar outra fonte e nunca consultar o arquivo protegido para
completá-los.

## 16. Banco, backups e R2

B01 concluiu o inventário estrutural somente leitura em 29/07/2026. O resultado
confirmado foi:

- produção contém as 10 tabelas, 113 colunas e 7 enums esperados pelo schema;
- `drizzle.__drizzle_migrations` existe, mas está vazio;
- o último snapshot cobre somente 8 tabelas e 89 colunas;
- há três divergências `text`/`varchar` em `audit_logs` e uma FK existente
  somente em produção;
- `0000` diverge do próprio snapshot e colide com `0001` em uma aplicação limpa;
- `0002` e `0003` não possuem snapshots e aparecem fora de ordem temporal no
  journal;
- `scripts/migrate-railway.mjs` aplica apenas `0000`, sem transação ou ledger;
- `monthlyGoal`, `attachmentExtras` e `photoExtras` dependem de DDL no startup;
- o Git prova quando `user_sessions` e `audit_logs` entraram no código, mas o
  ledger vazio impede provar como as tabelas foram criadas fisicamente.

Antes de qualquer schema/DDL ainda é obrigatório:

1. Não editar migrations antigas nem preencher o ledger por suposição.
2. Desenhar reconciliação idempotente entre produção, schema, snapshots,
   journal, migrador e rotinas `ensure*`.
3. Definir compatibilidade e rollback para tipos, FK e futuras persistências.
4. Confirmar backup recente concluído.
5. Definir e, conforme o risco, testar restauração.
6. Apresentar risco, janela, rollout e critérios de abortar.
7. Obter autorização específica antes de executar qualquer alteração.

PostgreSQL, retrato informado em 29/07/2026:

- backup diário recém-ativado;
- semanal ativo;
- último concluído então informado: quatro dias antes;
- PITR inativo;
- restore drill nunca realizado.

Esses dados envelhecem. Revalidar pelo navegador antes de DDL/destrutivo. Nada
de schema sem backup recente, plano de restauração, risco/janela, rollback e
autorização específica.

R2, último estado informado:

- sem backup independente;
- sem Bucket Lock;
- sem Lifecycle Rules;
- sem teste de restauração.

Nenhuma deleção destrutiva de mídia sem inventário, dry-run, recuperação,
tratamento de falha parcial, audit log e confirmação adicional.

## 17. S05 — senha mestre e sessões

S05-A concluiu a caracterização e S05-B concluiu a implementação local sem
afetar sessões reais.

Estado confirmado:

- o fallback foi removido da branch local, mas produção continua no código
  anterior até deploy autorizado;
- o hash configurado é validado e comparado em 32 bytes sem registrar valores;
- configuração ausente/inválida impede toda a árvore operacional do servidor;
- a credencial histórica deve ser considerada comprometida e rotacionada;
- `MASTER_PASSWORD_HASH` consta como existente em produção, mas existência e
  formato não foram revalidados externamente em S05-B;
- `disconnectSession` continua incrementando `sessionVersion` global; a
  revogação JWT realmente individual permanece item separado;
- `startServer().catch(console.error)` continua dívida preexistente para falhas
  posteriores à importação.

O próximo gate permite somente apresentar o plano operacional de ambientes,
rotação e rollout. Validar ou alterar segredo externo, desconectar usuários,
fazer push ou deploy exige autorização específica nova.

## 18. Pendências e dependências

### Concluídos

- S01: concluído na crítica, não em produção.
- S02: concluído na crítica, não em produção.
- H1: concluído e em produção.
- B01: inventário estrutural somente leitura concluído; nenhuma correção foi
  executada.
- S05-A: caracterização local concluída; nenhuma mudança chegou à produção.
- S05-B: implementação local concluída e validada; ainda não está em produção.

### B01 — banco somente leitura

Concluído. Foram entregues inventário real, comparação com Drizzle, snapshots,
migrations, journal, migrador, ledger, rotinas `ensure*` e evidência histórica
do Git. A origem física de `user_sessions` e `audit_logs` continua
indeterminável com a evidência disponível.

O resultado não autoriza correção. Persistência nova de S04, C01, E01 ou ledger
de reembolsos depende agora de plano de reconciliação idempotente, backup,
restauração, rollback e aprovação específica.

### S04 — idempotência de mutations

Dividir:

1. sem DDL: inventariar mutations, remover retry automático das não
   idempotentes e manter opt-in somente onde comprovado;
2. durável: `sales.create` e equivalentes podem exigir chave/constraint e
   dependem dos achados de B01, reconciliação aprovada, backup e plano de
   schema.

Não alterar mutations mecanicamente sem entender contratos/efeitos.

### S05

S05-A e S05-B local estão concluídos. O gate operacional depende de plano
aprovado, validação dos ambientes, rotação segura e rollout. Revogação
individual de sessão permanece item separado.

### F03

Fundação de data civil precede retenção de 90 dias, jobs, filtros e E01/E02.

### C01

Depende de inventário de usernames legados, modelo explícito, achados de B01 e,
se houver persistência, reconciliação idempotente do banco, backup e plano de
sessões/reativação.

### E01

Depende dos achados de B01 e de reconciliação aprovada para qualquer
persistência, além de F03, modelo aprovado de slot/restauração, modelo de
histórico de reembolso e compatibilidade legada. Deduplicação de clientes fica
fora.

### E02

Depende das invariantes de E01. Começa somente em dry-run. Purge real tem gate
posterior e continua bloqueado por PostgreSQL/R2.

### F02

Começa pelo inventário completo de filtros e contratos frontend/backend. Totais
e exportação devem coincidir com o conjunto filtrado inteiro.

### Itens futuros delimitados

F05, C02, C03, U01, U02, U03, P01, P02 e P03 permanecem nos limites acima.
Branches high/medium/low não podem começar sem seus gates.

## 19. Ordem candidata para discussão

Isto é recomendação, não autorização:

1. Apresentar o plano operacional de ambientes, rotação e rollout de S05.
2. Se aprovado em gate próprio, executar esse plano com critérios de abortar.
3. Se o rollout for adiado, inventariar mutations/desenhar fase sem DDL de S04.
4. Fundação F03 em plano separado.
5. Modelo/inventário legado de C01.
6. Modelo de E01, slots e reembolsos.
7. E02 somente dry-run.
8. Reconciliação de migrations/schema somente com gates de banco satisfeitos.
9. Altos, médios, baixos e opcionais conforme dependências.

Reavaliar antes mudanças recentes na `main`, backups e dependências novas.

## 20. Bloqueios atuais

- Ledger de migrations vazio e cadeia rastreada inconsistente; não existe plano
  de reconciliação aprovado.
- Origem física de `user_sessions` e `audit_logs` não comprovada.
- Backup PostgreSQL recente precisa ser reconfirmado.
- PITR informado como inativo.
- Restore drill nunca confirmado.
- R2 sem recuperação independente conhecida.
- Produção ainda contém o fallback anterior; a branch local o removeu, mas a
  credencial histórica segue comprometida e rotação/deploy não foram
  autorizados.
- Revogação individual não existe no modelo JWT/sessão atual e precisa de item
  separado.
- Usernames legados sem inventário.
- Modelo imutável de reembolso sem aprovação.
- Failover real multiprocesso do H1 não testado.
- DDL no startup de cada réplica permanece dívida.

## 21. Testes obrigatórios futuros

Após cada conjunto aprovado:

1. Revisar diff completo e arquivos necessários.
2. Procurar imports quebrados, referências antigas e código morto.
3. Rodar `pnpm run typecheck`.
4. Rodar `pnpm run test:backend`.
5. Prettier apenas no escopo rastreado.
6. Rodar `git diff --check`.
7. Rodar `pnpm run build`.
8. Testar fluxos afetados e relacionados.
9. Procurar segredos/arquivos locais.
10. Avaliar deploy e rollback.

Para `NovaVenda.tsx`/`Consultora.tsx`: validar 375 px, conexão lenta, nenhuma
dependência/query/animação pesada nova e aparência/comportamento preservados.

Nunca declarar “100% funcionando” sem validação efetiva.

## 22. Rollback

Branches:

- não usar `git reset --hard` ou force-push;
- se merge incompleto conflitar, diagnosticar antes de abortar;
- depois de push, reverter por novo commit revisável.

Produção:

- não fazer rollback de H1 sem nova autorização;
- diante de falha, diagnosticar read-only e apresentar opções;
- rollback de produção é ação externa sensível.

Banco/R2: rollback precisa existir antes da mudança original. Sem
backup/restauração, destrutivo continua bloqueado.

## 23. O que o novo chat pode fazer sem nova autorização

- Reler os três documentos.
- Verificar branch, SHAs, worktree e `origin/main`.
- Inspecionar somente o repositório/código local em modo read-only.
- Preparar o próximo plano pré-alteração.
- Preparar e apresentar o plano operacional de ambientes, rotação e rollout de
  S05, sem executar ações externas.
- Fazer perguntas de confirmação.

O acesso externo de B01 terminou. Qualquer novo acesso a PostgreSQL, R2,
Railway ou outro serviço externo exige escopo e aprovação específicos.

Não pode sem aprovação nova:

- implementar outro item;
- criar high/medium/low;
- mudar schema, migrations, Railway, GitHub ou R2;
- invalidar sessões;
- fazer merge/push/deploy na `main`;
- executar purge;
- ampliar C1/H1.

## 24. Próximo gate recomendado

S05-B local está concluído. O próximo gate é apresentar o plano operacional de
**validação dos ambientes, rotação da credencial histórica e rollout**, ainda
sem executar ação externa.

O plano deve cobrir:

- matriz de desenvolvimento local, testes, CI e produção, sem expor valores;
- confirmação de existência/formato válido em todas as réplicas antes do deploy;
- geração e distribuição segura da nova senha mestre;
- ordem entre rotação da env e deploy, comunicação e janela operacional;
- observabilidade de startup, healthcheck, autenticação e desconexões;
- critérios de abortar diante de env inválida, healthcheck falho ou regressão;
- rollback de código/configuração sem restaurar a credencial comprometida;
- confirmação de que nenhuma sessão será invalidada pela mudança isolada;
- decisão explícita sobre push e deploy.

Aguardar aprovação específica antes de consultar/alterar ambiente externo,
rotacionar segredo, afetar sessões, fazer push ou deploy.

## 25. Mensagem curta para o novo chat

> Continue na branch `codex/qol-critical`. Antes de agir, leia integralmente
> `TODO.md`, `AUDITORIA_QUALIDADE_DE_VIDA.md` e
> `CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md`. Não abra nem use
> `docs/REVISAO_TECNICA_GRANULAR_VENDAS.md`. Confirme SHAs/worktree e informe
> percentuais em todas as atualizações. B01, S05-A e S05-B local estão
> concluídos; retome apresentando somente o plano operacional de ambientes,
> rotação e rollout. Não acesse segredo externo, altere sessões, faça push ou
> deploy sem autorização explícita.

## 26. Estado de encerramento

- H1 em produção e observado saudável: concluído.
- C1 validado na crítica: concluído, ainda não em produção.
- Integração/crítica sincronizadas com a main do hotfix: concluído.
- B01 somente leitura: concluído, sem alteração de produção.
- Registro documental de B01: commit local `8d4ea4e`.
- Instruções persistentes de programação: commits locais `df10c8c` e
  `96fecd6`.
- S05-A: 13 testes de caracterização no commit local `4e0be94`, sem alteração
  de produção.
- S05-B: implementação/testes no commit local `cee9b77` e versão `2.16.3` no
  commit local `2cffb03`, ainda sem produção.
- Este checkpoint documental foi autorizado para commit local; consultar
  `HEAD` para seu SHA.
- Nenhum push foi executado.
- S05-B local: **100% concluído / 0% restante**.
- Gate operacional S05: **0% concluído / 100% restante**.
- Próxima ação segura: apresentar somente o plano operacional.
- Plano global estimado revisado: **20% concluído / 80% restante**.
