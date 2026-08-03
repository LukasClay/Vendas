# Instruções para agentes

## Escopo condicional

Este arquivo se aplica somente a tarefas de programação ou manutenção técnica
relacionadas a este repositório. Isso inclui código, testes, depuração, revisão,
arquitetura, segurança, banco de dados, storage, infraestrutura, CI/CD, deploy,
versionamento e documentação técnica do software.

Se a solicitação não tiver relação com programação ou com a manutenção técnica
deste sistema, o restante deste arquivo não precisa ser aplicado. Nesses casos,
não é necessário ler os documentos técnicos, verificar Git ou informar
percentuais apenas por causa deste `AGENTS.md`.

Instruções explícitas do sistema, do desenvolvedor e do usuário sempre têm
precedência.

## Regras gerais para programação neste repositório

1. Ler integralmente `TODO.md` antes de revisar ou alterar o software.
2. Tratar `TODO.md` como a fonte permanente principal das regras do projeto.
3. Preservar alterações e arquivos do usuário que não pertençam ao escopo.
4. Não expor segredos, credenciais, hashes, tokens ou dados de produção.
5. Não executar commit, push, merge, deploy, DDL, operação destrutiva ou ação
   externa sensível sem autorização explícita correspondente.
6. Antes de uma alteração relevante, apresentar plano, impacto, riscos, testes
   e rollback; aguardar aprovação quando as regras do projeto exigirem.
7. Depois de uma alteração autorizada, revisar o diff e validar somente o
   escopo necessário. Não ampliar silenciosamente a tarefa.
8. Este arquivo registra regras, não concede autorização para executar etapas.

## Julgamento crítico e alinhamento com o usuário

- Tratar a solicitação e o objetivo do usuário como prioridade, sem agir como
  mero executor acrítico.
- Equilibrar a vontade do usuário com qualidade, segurança, correção,
  viabilidade técnica e planejamento. Preferências e opiniões do usuário são
  relevantes, mas não substituem a avaliação responsável das consequências.
- Quando o pedido literal comprometer materialmente esses critérios ou
  contrariar regras do projeto, explicar o conflito de forma objetiva e não o
  executar silenciosamente como se fosse adequado.
- Se não for possível atender exatamente ao pedido, propor a alternativa viável
  mais próxima e, sempre que possível, adaptar a execução para preservar a
  intenção e o resultado pretendido pelo usuário.
- Quando houver várias opções válidas, especialmente em decisões subjetivas ou
  reversíveis, respeitar a preferência do usuário. Se uma alternativa mudar
  materialmente o resultado ou o escopo, solicitar uma decisão antes de agir.

## Auditoria de Qualidade de Vida

Esta seção se aplica quando a tarefa mencionar a Auditoria de Qualidade de
Vida, branches `codex/qol-*` ou os documentos de auditoria abaixo.

### Retomada obrigatória

Antes de analisar, planejar ou alterar qualquer item da auditoria:

1. Confirmar branch e worktree com comandos somente leitura.
2. Ler integralmente, nesta ordem:
   - `TODO.md`;
   - `AUDITORIA_QUALIDADE_DE_VIDA.md`;
   - `CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md`.
3. Confirmar SHAs e o estado atual de `origin/main` conforme o protocolo de
   continuidade.

Após compactação de contexto durante a auditoria, reler primeiro
`AUDITORIA_QUALIDADE_DE_VIDA.md`, depois
`CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md` e então confirmar `TODO.md`.

### Função de cada documento

- `TODO.md`: regras permanentes de arquitetura, negócio, UX e segurança.
- `AUDITORIA_QUALIDADE_DE_VIDA.md`: decisões e achados técnicos detalhados.
- `CONTINUIDADE_AUDITORIA_QUALIDADE_DE_VIDA.md`: estado operacional mais
  recente, percentuais, SHAs, autorizações consumidas, bloqueios e próximo gate.

Não copiar o estado operacional para este arquivo. Consultar a continuidade
para evitar que branch, SHA, percentual ou próximo passo fiquem obsoletos aqui.

### Arquivo protegido

`docs/REVISAO_TECNICA_GRANULAR_VENDAS.md` é um arquivo do usuário e não faz
parte da auditoria.

- Não abrir, ler ou usar como fonte.
- Não editar, mover, renomear ou apagar.
- Não adicionar ao stage ou a commits.
- Não incluir em formatação ou busca global que leia seu conteúdo.

### Percentuais e gates

- Toda atualização da auditoria deve informar `X% concluído / Y% restante`,
  somando 100%, para a tarefa ativa e, quando útil, para o plano global.
- Silêncio, troca de chat, compactação ou disponibilidade de ferramenta não
  renovam nem ampliam autorização.
- Antes de cada grande etapa, apresentar o plano e respeitar o próximo gate
  registrado na continuidade.
- Commits, pushes, merges, deploys, acesso externo, alterações de sessão,
  schema/DDL e operações destrutivas exigem autorização específica.
- Nunca usar `pnpm run format:check` quando ele puder alcançar o arquivo
  protegido; usar Prettier direcionado e `git diff --check`.

### Delegação

- Todo subagente que atuar na auditoria deve respeitar este arquivo e ler os
  três documentos obrigatórios antes de trabalhar.
- A tarefa delegada deve declarar limites de arquivos, ações permitidas e
  proibições relevantes.
- Subagentes não podem interpretar a delegação como autorização para commit,
  push, acesso externo ou ampliação de escopo.
