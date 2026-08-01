# Auditoria de Qualidade de Vida

## Retomada obrigatoria apos compactacao

Sempre que o contexto desta tarefa for compactado, a primeira acao obrigatoria
deve ser reler este arquivo integralmente. Somente depois dessa releitura o
trabalho podera prosseguir normalmente, retomando o ultimo estado confirmado e
respeitando o escopo, as autorizacoes e os bloqueios aqui registrados.

A compactacao nao amplia autorizacoes, nao substitui confirmacoes explicitas e
nao permite presumir que uma etapa pendente foi aprovada.

## Finalidade e limite de autorização

Este arquivo registra o mapa técnico, as decisões oficiais do proprietário, as
dependências e o planejamento da auditoria para evitar perda de contexto.

Sua criação foi autorizada explicitamente em 29/07/2026. A implementação foi
posteriormente autorizada apenas para a estrutura inicial de branches e a etapa
C1 (`S01` e `S02`). Fora desse escopo:

- não alterar código, configuração, schema ou documentação adicional;
- não executar merge, push ou deploy;
- não alterar a `main`;
- não executar DDL ou operações destrutivas em PostgreSQL ou R2;
- não considerar silêncio ou compactação como autorização.

Em 29/07/2026, o proprietário também autorizou explicitamente:

- a execução do inventário B01 estritamente somente leitura;
- o registro dos resultados de B01 neste arquivo e em
  `CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md`, sem commit ou push.

Essas autorizações foram consumidas e não permitem corrigir schema, migrations,
dados, infraestrutura ou documentação adicional.

Em 01/08/2026, o proprietário autorizou explicitamente:

- criar `AGENTS.md` na raiz, limitado a tarefas de programação/manutenção
  técnica, e registrá-lo em commit local;
- autorizar posteriormente o commit local `8d4ea4e` do registro B01, sem
  push;
- implementar somente os testes sintéticos de caracterização S05-A, sem
  alterar código de produção, configuração, sessões reais ou serviços externos;
- após a revisão, registrar o checkpoint S05-A nestes dois documentos e criar
  commits locais separados para teste e documentação, sem push.

Essas autorizações são específicas e não autorizam S05-B, rotação de segredo,
deploy, alteração de sessões, acesso externo ou mudança de schema.

Também foi autorizada e executada a exclusão somente destes três arquivos
locais não rastreados:

- `Iniciar Solo Leveling Otimizado.cmd`;
- `iniciar-solo-leveling-otimizado.ps1`;
- `LEIA-ME - Solo Leveling otimizado.txt`.

O arquivo `docs/REVISAO_TECNICA_GRANULAR_VENDAS.md` deve ser preservado.

## Estado do repositório

- Branch de auditoria: `codex/qol-audit-20260729`.
- Commit-base: `79660b694925a33dbb077631648d7aef64a3591a`.
- A branch de auditoria estava em divergência `0/0` com `origin/main` no início
  do trabalho.
- Nenhuma alteração de código foi realizada durante a auditoria inicial.
- Branch de integração criada no commit-base:
  - `codex/qol-integration`.
- Branches de execução posteriores:
  - `codex/qol-critical`;
  - `codex/qol-high`;
  - `codex/qol-medium`;
  - `codex/qol-low`.
- A branch crítica local contém o teste S05-A no commit `4e0be94`; o remoto
  permanece em `0f2642a` e nenhum push foi executado.

## Método obrigatório de trabalho

1. Manter primeiro um mapa de arquitetura, módulos e fluxos.
2. Analisar cada área separadamente.
3. Registrar conclusões intermediárias estruturadas neste arquivo.
4. Consolidar os resultados e remover duplicidades.
5. Verificar novamente achados que cruzem frontend, backend, banco, storage,
   autenticação ou infraestrutura.
6. Antes de cada grande etapa, apresentar plano pré-alteração.
7. Implementar somente itens e escopos confirmados explicitamente.

## Mapa de arquitetura

### Frontend

- React, Vite, Tailwind e componentes shadcn/Radix.
- Cliente tRPC e React Query.
- Rotas carregadas sob demanda.
- Papéis:
  - Vendedor: Nova Venda e Vendas do mês atual.
  - Consultora: Trabalhos, Nova Venda, Minhas Vendas e Consultas.
  - ADM: Dashboard, Cadastros, Vendas, Relatórios, Produtos, Trabalhos,
    Consultas, Alertas, Funcionários, Lixeira, Segurança e Configurações.

### Backend

- Express e routers tRPC.
- Procedimentos públicos, autenticados e administrativos.
- Autenticação JWT/cookie, `sessionVersion` e tabela de sessões.
- Serviços de vendas, clientes, produtos, consultas, relatórios, push,
  configurações, segurança e pesquisa.

### Dados e storage

- PostgreSQL com Drizzle.
- Cloudflare R2/S3 para comprovantes e fotos.
- Soft delete de vendas.
- `audit_logs` e `user_sessions` existem em produção, mas não possuem origem
  comprovada nas migrations rastreadas.

### Operação

- Railway em US East/Virginia; o retrato inicial tinha uma réplica e, em
  29/07/2026, duas réplicas foram observadas. A operação não deve depender de
  quantidade fixa.
- `TZ=America/Sao_Paulo`.
- Healthcheck `/api/health`, timeout de 300 segundos.
- Jobs de alertas e relatórios executados dentro do processo HTTP.
- GitHub sem proteção da `main`, PR obrigatório ou required checks.
- `Verify` existe, mas não bloqueia push/deploy.

## Fluxos sensíveis

### Fluxo principal de trabalho

`Nova Venda -> envio para Consultora -> preenchimento pela Consultora ->
Pendente -> Feito`

Esse fluxo não pode ser reorganizado ou reinterpretado sem autorização
específica.

### Outros fluxos sensíveis

- invalidação de sessões e desconexão de funcionários;
- desativação e reativação de usuários;
- alteração de papel ou permissão;
- restauração forçada de venda;
- purge manual ou automático;
- reembolso;
- alteração de status ou responsável de venda/trabalho;
- mudanças visíveis nos painéis utilizados pelos funcionários.

## Decisões oficiais recebidas em 29/07/2026

### Branches

- Usar branch de integração e branches sequenciais por prioridade.
- Cada branch de prioridade nasce da integração já atualizada.
- Quando seguro, um commit identificável por item.
- Não misturar mudanças sem relação no mesmo commit.
- Nenhum merge/push/deploy para `main` sem avaliação final.

### C01 — Identidade de funcionários

- Não depender de interpretar `_old` ou sufixos hexadecimais.
- Propor armazenamento explícito do username original.
- Preservar ID, vendas históricas e rastreabilidade do funcionário antigo.
- Liberar o username original para novo cadastro.
- Tratar underscores, múltiplas desativações, colisões, estados legados,
  reativação com username ocupado e sessões.
- Antes da implementação, propor tratamento dos dados legados de produção.

### E01/E02 — Lixeira, consultas, restauração e purge

- Soft delete por 90 dias, usando a data civil de São Paulo.
- Venda excluída fica oculta das telas operacionais, mas o slot original de
  Consulta Cartas permanece reservado durante todo o período restaurável.
- Restauração normal recupera automaticamente a venda com o mesmo slot.
- O slot só é liberado por cancelamento/reembolso confirmado, exclusão
  permanente ou purge após 90 dias.
- Para inconsistências legadas em que o slot esteja ocupado, a restauração
  exige que o ADM escolha outro slot livre. Cancelar mantém a venda na lixeira.
- Nunca podem existir duas vendas ativas no mesmo slot e não será criado o
  estado `aguardando_reagendamento`.
- Purge começa somente em dry-run.
- Dry-run lista quantidades, IDs, mídias e vínculos com consulta, cliente e
  reembolso.
- Execução deve ser idempotente, protegida contra duplicidade e auditada.
- Exclusão real depende de revisão e nova confirmação.

### Clientes canônicos

- Avaliar duplicados e possível identidade canônica.
- Não incluir deduplicação automática em E01.
- Proposta separada deve cobrir identificação, normalização de telefone,
  homônimos, merge reversível, vendas e auditoria.

### Reembolsos

- Funcionam como extrato imutável.
- Preservar venda, cliente, valor, item/consulta, responsável, motivo,
  timestamp, estado anterior e posterior.
- Aprovação não pode apagar o vínculo original.
- Qualquer estrutura de eventos/lançamentos exige modelo prévio e aprovação.

### F03 — Timezone

- Instantes técnicos continuam em UTC.
- Datas de negócio usam `America/Sao_Paulo`.
- Frontend e backend devem usar a mesma interpretação.
- Não usar `toISOString().slice(0, 10)` para data civil.
- Testar viradas de dia, mês e ano.

### Painéis protegidos

Foram autorizados para planejamento e futura execução, após o plano da etapa:

- F03: somente data civil de São Paulo.
- F05: somente corrigir o destino do push já existente da Consultora.
- C02: unificar interpretação, sem novas restrições ou regras.
- C03: alterar apenas o texto para `Vendas do mês atual`.
- U01: distinguir loading, erro, vazio, cache e falha de atualização.
- U02: impedir duplo envio e informar falha de leitura, sem mudar contrato.
- U03: acessibilidade incremental sem mudar aparência/lógica principal.
- P01: otimização de carregamento sem mudança visual/comportamental.
- P02: demanda/paginação sem ampliar período, receita ou permissão.
- P03: somente Object URL para preview, preservando contrato de envio.

### F02 — Todas as vendas

- Totais, contagens e exportações abrangem todo o filtro, não só a página.
- Inventariar filtros antes de alterar a interface.
- Preservar digitação manual de datas.
- Propor atalhos de mês atual, mês anterior, ano atual, mês e ano.
- Não remover filtros sem justificativa e nova autorização.

### Infraestrutura externa

- Duas réplicas Railway foram observadas em 29/07/2026; jobs devem suportar
  qualquer quantidade de réplicas.
- Não alterar GitHub ou Railway diretamente.
- Recomendar proteção da `main`, PR obrigatório, Verify obrigatório, bloqueio
  de force push/exclusão, deploy seguro, readiness/liveness e rollback.

### Banco e backups

- `user_sessions` e `audit_logs` existem desde pelo menos 31/03/2026.
- Não há migration Drizzle comprovada para essas tabelas.
- B01 concluiu o inventário de produção, a comparação com Drizzle/migrations e
  a verificação de `__drizzle_migrations`. O ledger existe, mas está vazio, e a
  cadeia rastreada é inconsistente.
- Antes de schema/DDL ainda é obrigatório:
  1. não editar migrations antigas nem preencher o ledger por suposição;
  2. propor reconciliação e compatibilidade idempotentes;
  3. definir backup, restauração, rollout, rollback e obter autorização.
- PostgreSQL:
  - backup diário recém-ativado;
  - semanal ativo;
  - último backup informado concluído há quatro dias;
  - PITR inativo;
  - restauração nunca testada.
- Exigir backup recente concluído e plano de restauração antes de DDL ou
  operação destrutiva.
- R2:
  - sem backup independente;
  - sem Bucket Lock;
  - sem Lifecycle Rules;
  - sem teste de restauração.
- Nenhuma exclusão destrutiva de mídia sem inventário, dry-run, recuperação,
  tratamento de falha parcial, auditoria e nova confirmação.

### S05 — Senha mestre

- `MASTER_PASSWORD_HASH` existe em produção.
- Remover fallback e validar formato após plano de rollout.
- Ausência/formato inválido devem falhar cedo e com segurança.
- Nunca registrar senha ou hash.
- Testar desenvolvimento, testes e produção.
- Caracterizar `disconnect` antes de alterar código de sessões.

## Itens críticos e dependências preliminares

### S01 — Sanitização de `auth.me`

- Remove `passwordHash` e campos internos das respostas.
- Não requer DDL.
- Deve começar por teste de contrato que falhe no estado atual.
- Pode estabelecer o padrão de DTO público usado por S02.

### S02 — Sanitização de mídias e storage keys

- Remove keys de `reports.exportData`, `sales.listDeleted` e retornos
  equivalentes.
- Não requer DDL.
- Compartilha estratégia de testes de fronteira com S01.
- Deve permanecer em commit separado.

### S04 — Idempotência de mutations

- Mitigação imediata sem DDL: remover retry automático de mutations não
  idempotentes e permitir opt-in apenas onde comprovado.
- Proteção durável de `sales.create` pode exigir chave persistida/constraint.
- A parte durável depende dos achados de B01, reconciliação idempotente, backup
  e plano de schema aprovado.

### S05 — Senha mestre

- Produção já possui a variável necessária.
- A caracterização S05-A de `disconnectSession` e `disconnectUser` foi
  concluída sem banco, sessão ou segredo real.
- A remoção do fallback não deve invalidar sessões por si só.
- Rollout precisa validar todos os ambientes antes do deploy.

### B01 — Bootstrap e compatibilidade do banco

- O inventário somente leitura foi concluído em 29/07/2026.
- Produção possui as 10 tabelas, 113 colunas e 7 enums esperados pelo schema
  atual, com divergências registradas na seção de execução B01.
- O ledger `drizzle.__drizzle_migrations` existe, mas não possui registros.
- Nenhuma correção, DDL, DML, migration ou leitura de dados de negócio foi
  executada.
- É pré-requisito para qualquer nova tabela/coluna necessária a S04, C01,
  E01 ou histórico imutável de reembolsos.
- DDL permanece bloqueada até backup recente e plano/teste de restauração.

### E01 — Estado de vendas, slots e reembolsos

- Qualquer persistência depende dos achados de B01 e de reconciliação aprovada;
  o item também depende da definição de data civil e de modelo aprovado.
- Deve permanecer isolado dos itens simples de segurança.
- Deduplicação de clientes é item separado.
- Purge destrutivo não integra E01; E02 começa em dry-run e possui gate próprio.

## Dependências transversais

- A fundação de data civil de F03 é pré-requisito para expiração de 90 dias,
  jobs e filtros; adoção visual completa permanece na etapa alta.
- O inventário B01 foi concluído, mas qualquer persistência nova de S04, C01,
  E01 ou reembolsos ainda depende de plano idempotente de compatibilidade,
  backup recente, restauração e autorização.
- E01 fornece histórico/invariantes usados pelo dry-run E02.
- S01 e S02 podem compartilhar infraestrutura de testes, mas não o mesmo
  commit funcional.
- O baseline de disconnect de S05 foi concluído; S05-B ainda depende de plano
  aprovado, validação dos ambientes e rotação segura da credencial histórica.
- Nenhum item autoriza alteração do fluxo principal de trabalho.

## Bloqueios atuais

1. A cadeia de migrations não é uma fonte confiável do estado atual:
   `__drizzle_migrations` está vazio, snapshots estão incompletos e existem
   migrations conflitantes ou fora de ordem.
2. O último backup PostgreSQL informado tem quatro dias; antes de DDL precisa
   existir backup recente concluído.
3. Nunca houve restore drill; o plano de restauração precisa ser definido.
4. R2 não possui recuperação independente; deleção real permanece bloqueada.
5. O fallback de senha mestre permanece no código e a credencial histórica
   deve ser considerada comprometida; remoção, validação e rotação ainda não
   foram autorizadas.
6. A estrutura imutável de reembolsos ainda precisa de proposta aprovada.
7. Dados legados de usernames precisam ser inventariados antes de C01.
8. `disconnectSession` incrementa a versão global do usuário; revogação
   realmente individual exige desenho separado de JWT/sessão.

## Estrutura de branches proposta

Todas partirão do commit-base da auditoria:

1. `codex/qol-integration` a partir de `79660b6`.
2. `codex/qol-critical` a partir de `codex/qol-integration`.
3. Após revisão e integração dos críticos:
   `codex/qol-high` a partir da integração atualizada.
4. Depois, `codex/qol-medium`.
5. Finalmente, `codex/qol-low`.

`codex/qol-integration` foi criada no commit-base. A criação de
`codex/qol-critical` e a etapa C1 (`S01` e `S02`) foram autorizadas em
29/07/2026. As branches de prioridades posteriores continuam sem autorização.

## Próximo gate

O inventário B01 foi concluído sem alteração de estado. Nenhuma correção de
schema, migration ou ledger está autorizada. Antes de qualquer DDL ainda são
obrigatórios backup recente, estratégia de restauração, plano idempotente,
janela, rollback e autorização específica.

S05-A foi concluído. O próximo candidato é apresentar o plano pré-alteração de
S05-B para remover o fallback, validar `MASTER_PASSWORD_HASH`, falhar cedo e
preparar rotação/rollout. O plano não autoriza alterar segredo externo,
invalidar sessões, desconectar funcionários, implementar S05-B ou fazer deploy.

## Registro de execução — C1

- `S01` — commit `1df743e`: `auth.me` passou a retornar somente `role`, `name`,
  `email` e `username`; o usuário completo permanece disponível apenas no
  contexto interno.
- `S02` — commit `95924ca`: `reports.exportData` e `sales.listDeleted`
  preservam seus wrappers e dados públicos, mas não retornam storage keys nem
  os JSONs internos de mídia.
- Versionamento — commit `11d2243`: versão visível alterada de `2.16.0` para
  `2.16.1`.
- Validação automática: typecheck aprovado; 24 arquivos e 186 testes de
  backend aprovados; build de produção aprovado; Prettier aprovado no escopo;
  `git diff --check` aprovado.
- O aviso já existente de chunk de exportação acima de 500 kB permaneceu no
  build. O `format:check` global continua afetado pelo checkout CRLF do Windows
  e pelo documento não rastreado preservado
  `docs/REVISAO_TECNICA_GRANULAR_VENDAS.md`.
- Nenhum schema, migration, sessão, permissão, regra de negócio, mídia no R2,
  fluxo operacional ou configuração externa foi alterado.
- A revisão de S01 identificou, fora do escopo autorizado, que as rotas
  administrativas `users.listAll` e `users.getById` ainda expõem alguns campos
  internos (`openId` e, em `getById`, `deletedAt` e `sessionVersion`). Elas não
  expõem `passwordHash`; uma eventual redução desse contrato precisa de item e
  aprovação próprios.
- Uma falha local do aplicador de patch removeu temporariamente dois arquivos
  rastreados; ambos foram restaurados exatamente de `HEAD` antes da aplicação
  controlada de S02, sem perda de alterações.
- Nenhum merge, push ou deploy foi executado.

## Registro de execução — B01

### Escopo e barreiras de leitura

- B01 foi autorizado e executado em 29/07/2026 exclusivamente como inventário
  estrutural.
- A conexão PostgreSQL usou `default_transaction_read_only=on`, transação
  `READ ONLY` com isolamento `REPEATABLE READ`, `search_path=pg_catalog`,
  `statement_timeout=10s`, `lock_timeout=1s` e
  `idle_in_transaction_session_timeout=30s`.
- Foram consultados somente `pg_catalog`, `information_schema` e, após validar
  tipo, schema, ausência de RLS/regras/herança, os campos `id`, `hash` e
  `created_at` de `drizzle.__drizzle_migrations`.
- Nenhuma linha de clientes, vendas, usuários, sessões, auditoria, push ou
  storage foi consultada.
- A transação terminou com `ROLLBACK`; a conexão e a credencial foram
  descartadas.

### Inventário de produção

- PostgreSQL `18.4`; timezone do servidor `Etc/UTC`.
- Schemas de aplicação: `public` e `drizzle`.
- `public`: 10 tabelas, 113 colunas, 10 sequences e 7 enums.
- 13 índices: 10 chaves primárias e 3 uniques
  (`users.openId`, `users.username` e `app_settings.key`).
- Não existem views, materialized views, foreign tables, índices não únicos,
  triggers de aplicação, RLS ou policies nos schemas inventariados.
- A única extensão encontrada foi `plpgsql`.
- As sequences de ID estão vinculadas às respectivas colunas `serial`.
- `drizzle.__drizzle_migrations` existe com estrutura válida, mas contém zero
  registros.

### Divergências entre produção e `drizzle/schema.ts`

- Todas as 10 tabelas, 113 colunas e 7 enums esperados pelo schema existem em
  produção.
- Três tipos de `audit_logs` divergem:
  - `userName`: schema `varchar(256)`, produção `text`;
  - `action`: schema `varchar(128)`, produção `text`;
  - `ipAddress`: schema `varchar(64)`, produção `text`.
- Produção possui a FK `audit_logs.userId -> users.id ON DELETE SET NULL`; ela
  não está declarada no schema nem nas migrations rastreadas.
- Essa FK gera quatro triggers internos do PostgreSQL. Não há triggers de
  aplicação.
- As outras dez relações descritas no código apenas como comentários “FK” não
  possuem constraints reais. Também não há índices dedicados para essas
  referências.
- A ordem física de colunas em algumas tabelas difere da ordem atual do schema
  por adições posteriores; o acesso por nome permanece compatível.

### Divergências da cadeia de migrations

- O schema atual possui 10 tabelas, 113 colunas e 7 enums.
- O último snapshot (`0001`) possui somente 8 tabelas, 89 colunas e 7 enums.
- O snapshot `0000` registra 76 colunas, mas o SQL `0000` foi alterado depois
  para incluir `sales.deletedAt`, `users.sessionVersion` e
  `products.isSystem`, chegando a 79.
- `0001` tenta adicionar novamente essas três colunas sem `IF NOT EXISTS`; uma
  aplicação limpa da sequência colide primeiro em `products.isSystem`.
- `0002` e `0003` constam no journal, mas não possuem snapshots. Seus
  timestamps também são anteriores aos de `0000` e `0001`, podendo fazê-los
  ser ignorados quando houver migration mais nova registrada.
- `0003` contém quatro `ALTER TABLE` sem `statement-breakpoint` ou
  `IF NOT EXISTS`.
- `scripts/migrate-railway.mjs` lê apenas `0000`, não usa transação, não
  processa o journal e não registra o ledger.
- `ensureSystemProducts`, `ensurePhotoColumns` e `ensureMonthlyGoalColumn`
  continuam executando DDL no startup de cada réplica.
- `users.monthlyGoal`, `sales.attachmentExtras` e `sales.photoExtras` não
  possuem migration ou snapshot e são garantidos somente pelo startup.
- No estado atual, `pnpm db:push`, `drizzle-kit migrate` e
  `scripts/migrate-railway.mjs` não são caminhos seguros para produção.

### Origem provável e limite da evidência

- `user_sessions` e `audit_logs` entraram no código no commit `b61b1c1`, sem
  migration, snapshot ou rotina `ensure*`.
- O Git comprova a origem no código, mas não a criação física das tabelas.
  Com o ledger vazio, não é possível distinguir entre comando manual,
  migration não versionada ou SQL direto.
- `sales.attachmentExtras` e `sales.photoExtras` entraram na linhagem atual no
  commit `0019ec3`; a hipótese mais forte é criação pelo startup.
- `users.monthlyGoal` entrou no commit `2376003` com `ensure*`; a hipótese mais
  forte também é criação pelo startup.
- Fotos e `products.isSystem` possuem caminhos DDL sobrepostos entre migration
  e `ensure*`; o inventário estrutural não determina qual executou primeiro.

### Resultado e bloqueios residuais

- Não há coluna ou tabela esperada pelo código ausente em produção.
- O risco principal identificado é de migration/deploy futuro, não uma
  incompatibilidade estrutural imediata da aplicação.
- Não editar migrations antigas, preencher o ledger ou alinhar tipos/FK sem
  plano separado e aprovação.
- Qualquer correção depende de backup recente confirmado, restauração,
  compatibilidade idempotente, rollback e nova autorização.
- B01: **100% concluído / 0% restante**.
- Plano global estimado: **18% concluído / 82% restante**.

## Registro de execução — S05-A

### Escopo e barreiras

- S05-A foi autorizado e executado em 01/08/2026 somente como caracterização
  local de `disconnectSession` e `disconnectUser`.
- O novo arquivo `server/security.disconnect.test.ts` usa senha e hash
  exclusivamente sintéticos, restaura a env após o teste e mocka integralmente
  o módulo de banco.
- Nenhum código de produção, configuração, segredo real, banco, sessão,
  funcionário ou serviço externo foi alterado ou acessado.
- O teste foi registrado no commit local `4e0be94`, sem push.

### Baseline confirmado

- Chamadores anônimos e não administradores são bloqueados antes de qualquer
  efeito; senha mestre incorreta também bloqueia ambos os endpoints.
- `disconnectSession` procura o ID solicitado, pede incremento
  `sessionVersion + 1` para o usuário encontrado, exclui somente a linha da
  sessão solicitada e então registra auditoria.
- Sessão desconhecida ainda retorna sucesso, exclui pelo ID informado e audita
  `targetUserId: null`, sem incremento de versão.
- `disconnectUser` não confirma previamente a existência do usuário; pede o
  incremento global de versão, exclui todas as sessões registradas do ID e
  registra auditoria.
- Se o `getDb()` do router retornar `null`, ambos ainda chamam os helpers de
  exclusão/auditoria e retornam sucesso sem incremento. Esses helpers consultam
  `getDb()` novamente e podem também virar no-op se o banco continuar
  indisponível, produzindo falso sucesso.
- Falha no update interrompe exclusão e auditoria. Falha na exclusão ocorre
  depois da chamada de update e impede auditoria. Falha na auditoria é
  propagada depois das chamadas de update e exclusão.
- Os payloads esperados de auditoria são exatos e não contêm a senha nem o hash
  sintéticos.
- A implementação atual não oferece revogação JWT realmente individual:
  `disconnectSession` incrementa a versão global do usuário; o JWT não carrega
  identificador de sessão e a autenticação não consulta `user_sessions`.
- A interface administrativa chama somente `disconnectUser`; a semântica de
  revogação individual deve ser tratada em item separado.
- O fallback rastreado permanece no código de produção. A credencial histórica
  associada deve ser considerada comprometida e rotacionada antes do rollout;
  nenhum valor foi reproduzido neste registro.
- A existência de `MASTER_PASSWORD_HASH` em produção está registrada nos
  documentos, mas não foi revalidada externamente durante S05-A.

### Validação e resultado

- Teste direcionado: 1 arquivo, 13 testes aprovados.
- Backend completo: 29 arquivos, 223 testes aprovados.
- `pnpm run typecheck` e `pnpm run build` aprovados.
- Prettier direcionado, whitespace e revisão independente aprovados sem
  bloqueador final.
- O aviso preexistente do chunk `exports` acima de 500 kB permaneceu.
- S05-A: **100% concluído / 0% restante**.
- Plano global estimado: **18% concluído / 82% restante**.
