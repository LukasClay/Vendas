# Auditoria de Qualidade de Vida

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

- Railway em US East/Virginia, uma réplica no momento.
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

- Railway possui uma réplica hoje, mas jobs devem suportar múltiplas.
- Não alterar GitHub ou Railway diretamente.
- Recomendar proteção da `main`, PR obrigatório, Verify obrigatório, bloqueio
  de force push/exclusão, deploy seguro, readiness/liveness e rollback.

### Banco e backups

- `user_sessions` e `audit_logs` existem desde pelo menos 31/03/2026.
- Não há migration Drizzle comprovada para essas tabelas.
- Antes de schema/DDL:
  1. inventariar produção;
  2. comparar Drizzle e todas as migrations;
  3. verificar `__drizzle_migrations`;
  4. não editar migrations antigas;
  5. propor compatibilidade idempotente.
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
- A parte durável depende do inventário B01 antes de qualquer alteração de
  schema.

### S05 — Senha mestre

- Produção já possui a variável necessária.
- Antes da alteração, caracterizar `disconnectSession` e `disconnectUser`.
- A remoção do fallback não deve invalidar sessões por si só.
- Rollout precisa validar todos os ambientes antes do deploy.

### B01 — Bootstrap e compatibilidade do banco

- Começa por inventário somente leitura, não por editar SQL.
- É pré-requisito para qualquer nova tabela/coluna necessária a S04, C01,
  E01 ou histórico imutável de reembolsos.
- DDL permanece bloqueada até backup recente e plano/teste de restauração.

### E01 — Estado de vendas, slots e reembolsos

- Depende de B01, da definição de data civil e de modelo aprovado.
- Deve permanecer isolado dos itens simples de segurança.
- Deduplicação de clientes é item separado.
- Purge destrutivo não integra E01; E02 começa em dry-run e possui gate próprio.

## Dependências transversais

- A fundação de data civil de F03 é pré-requisito para expiração de 90 dias,
  jobs e filtros; adoção visual completa permanece na etapa alta.
- B01 antecede qualquer persistência nova de S04, C01, E01 ou reembolsos.
- E01 fornece histórico/invariantes usados pelo dry-run E02.
- S01 e S02 podem compartilhar infraestrutura de testes, mas não o mesmo
  commit funcional.
- S05 depende de validação externa das envs e do baseline de disconnect.
- Nenhum item autoriza alteração do fluxo principal de trabalho.

## Bloqueios atuais

1. Falta inventário somente leitura do schema real e de
   `__drizzle_migrations`.
2. O último backup PostgreSQL informado tem quatro dias; antes de DDL precisa
   existir backup recente concluído.
3. Nunca houve restore drill; o plano de restauração precisa ser definido.
4. R2 não possui recuperação independente; deleção real permanece bloqueada.
5. O comportamento atual de disconnect ainda precisa de teste de
   caracterização.
6. A estrutura imutável de reembolsos ainda precisa de proposta aprovada.
7. Dados legados de usernames precisam ser inventariados antes de C01.

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

Executar somente o registro documental e S01/S02 em commits separados. Depois
da validação integral, entregar relatório e aguardar nova confirmação antes de
integrar `codex/qol-critical`, criar branches posteriores ou ampliar o escopo.

O inventário B01 será somente leitura; o restore drill poderá ser conduzido
pelo navegador após plano próprio. O SHA de produção foi confirmado como
`79660b694925a33dbb077631648d7aef64a3591a`.
