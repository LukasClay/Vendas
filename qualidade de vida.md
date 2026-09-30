# Qualidade de vida — continuidade da auditoria ADM

> Checkpoint: 30/09/2026. Guia de retomada baseado nos documentos criados nesta
> conversa. Aplicável à auditoria UI/UX do ADM e aos lotes no Vendas Copy.
> Não substitui as regras do TODO nem concede autorização para novos lotes.

## Comece por aqui

1. Ler as regras do [TODO.md](TODO.md), preservando alterações locais de outras
   tarefas. Este é o guia permanente do projeto.
2. Consultar [roadmap.md](roadmap.md) para entregas, pendências e aprovações.
3. Ler a seção pertinente da
   [BASELINE_VISUAL_ADM.md](docs/BASELINE_VISUAL_ADM.md), fonte principal de
   resultados, evidências e limites dos testes desta conversa.
4. Consultar [AMBIENTE_TESTES_ADM.md](docs/AMBIENTE_TESTES_ADM.md) antes de
   operações no clone; contém identificação dos serviços, proteções e retorno.
5. Conferir `git status --short --branch` e atualizar a referência com
   `git fetch origin main`, conforme TODO. Não trocar de branch, descartar
   arquivos, fazer reset/rebase ou resolver divergência automaticamente.

Ler apenas o que for necessário ao lote. Não repetir a preparação do clone,
testes já válidos ou a auditoria inteira para recuperar contexto.

## Onde o trabalho parou

- Workspace: `C:\Users\Luketes\Documents\ChatGPT\Vendas`.
- Branch de implementação: `codex/adm-ui-ux`.
- Destino de testes: `https://vendas-copy-production.up.railway.app`.
- Versão validada no Copy: **2.19.2**.
- L01 concluído: consulta completa do histórico, totais, categoria no servidor e
  exportações completas com limite explícito.
- L02 concluído: campos de data dos relatórios cabem no celular e têm labels.
- L03 concluído: leitura da tabela de Todas as Vendas no desktop, autorizado
  pelo “perfeito, prossiga” após a consolidação dos documentos. Publicado e
  validado no Copy; produção continua fora da autorização.
- L03 passou em dez larguras de 320 a 2560 px, sem overflow da página; rolagem
  interna continua quando necessária. Em 1440 px, a maior linha da primeira
  página caiu de 189 para 133 px. Filtros, paginação, detalhes e abertura/
  cancelamento da edição foram conferidos, sem alterações de dados comerciais.
- Próxima etapa: avaliação das entregas e consolidação/definição do próximo
  lote. Não iniciar outro lote automaticamente.
- A lógica UTC dos atalhos dos relatórios permaneceu fora de L02.
- Auditoria ampla das 13 telas ainda precisa de consolidação de achados e
  critérios; baseline representativa não equivale a cobertura completa.
- Produção permaneceu inalterada nas conferências realizadas. Não houve
  autorização de merge em `main` ou publicação em produção.

Checkpoints históricos de código: L01 `d9a0065`, L02 `a20b16e`, L03 `5a30805`. Não registrá-los
como “HEAD atual/final”. Conferir `git rev-parse HEAD` ao retomar e consultar o
Railway antes de uma operação externa importante. Alterações documentais na
branch também podem provocar deployment automático se forem publicadas.

## Preservar o que já existe

No início desta consolidação documental, havia alterações locais em `TODO.md`
e `docs/historico.md`, além do arquivo não rastreado
`Qualidade de vida plugin gpt.md`. Eles pertencem a outro trabalho e não foram
incluídos nesta entrega. Conferir novamente o Git, pois isso pode mudar.

`Qualidade de vida plugin gpt.md` trata de outra iniciativa; não usar suas
instruções operacionais históricas como autorização para esta auditoria.
Este novo guia não o substitui.

## Limites operacionais

- Foco em UI/UX do ADM. Vendedora e consultora não recebem alterações visuais
  ou funcionais sem autorização própria. Mapear dependências compartilhadas.
- Preparação do clone e L01/L02/L03 foram autorizados especificamente nesta
  conversa. Essas autorizações não aprovam automaticamente outros lotes futuros.
- Testes que escrevem dados comerciais ficam somente no Copy verificado.
  Produção é origem de leitura autorizada, sem inserção, edição ou exclusão.
- Publicação na branch de testes pode atualizar o Copy. Confirmar escopo e
  destino autorizados antes de commit/push. A continuidade do L03 inclui seus
  documentos de execução, sem incluir alterações de outras tarefas.
- Preservar paleta, identidades por empresa e tema escuro nativo.
- Usar pnpm. Não iniciar `dev`, `start`, migrações ou comandos de banco sem
  conferir seus efeitos e a conexão efetiva.

## Conferir o isolamento antes de operações importantes

Produção e Copy estão no mesmo ambiente Railway. Validar serviço, branch, banco
efetivo, bucket e credenciais; confiar só no nome “Copy” é insuficiente.

As proteções documentadas precisam permanecer ativas no teste:

- `VENDAS_SANDBOX_MODE=1`, com host de banco e bucket exclusivos verificados;
- jobs e envios externos desabilitados, inclusive e-mail, push e notificações
  manuais;
- sessões/credenciais próprias do clone, sem reutilização de acesso de produção;
- bucket privado do clone e anexos servidos após login, respeitando o perfil;
- token de storage com vencimento registrado em **30/10/2026**. Renovação de
  acesso exige autorização; não usar chave de produção como atalho.

Dados copiados são um snapshot. Clone e produção têm diferenças de jobs,
réplicas, sessões e entrega de mídia. Os resultados do Copy reduzem a incerteza,
mas não permitem prometer funcionamento perfeito em produção.

O banco de teste anterior foi preservado. A configuração antiga também foi
guardada, mas reutilizava credenciais de produção; não restaurá-la integralmente.
Consultar o documento de ambiente se algum retorno for necessário.

## Como validar sem repetir trabalho desnecessário

Para mudanças de código, seguir as verificações do TODO: typecheck, testes de
backend e build, além da formatação dos arquivos alterados e `git diff --check`.
Não formatar o repositório inteiro para corrigir divergências preexistentes.

Para mudanças só documentais, validar conteúdo, links locais, formatação e diff.
Não incrementar a versão da aplicação ou executar seus testes sem mudança de
comportamento.

A validação visual precisa provar o resultado no navegador e nas larguras
afetadas. A baseline contém conferências em 390, 768 e 1440 px; L02 também em
320 px. Lotes de layout desktop precisam ampliar medidas quando seu escopo
envolver notebook ou ultrawide; não afirmar que toda a matriz original já passou.

Manter acessíveis filtros, ações e informações. Se o lote afetar consultas,
validar totais/paginação com uma referência independente. Se afetar exportações,
conferir o conteúdo dos arquivos finais, além do toast ou clique no botão.

Não repetir um fluxo completo de escrita da vendedora/consultora em todo ajuste
CSS do ADM. Definir a regressão necessária pelas dependências e riscos do lote;
se houver escrita autorizada no clone, usar dados fictícios rastreáveis e registrar
a limpeza sem alterar vendas históricas.

## Chrome e arquivos de evidência

- O usuário autorizou o Chrome do computador e autenticou o Copy. Sessões e
  conexão da extensão podem expirar; verificar o estado ao retomar.
- Preservar abas do usuário e seus filtros/preenchimentos. Preferir uma aba
  própria de teste para navegação e resetar overrides de viewport ao finalizar.
- O alarme sobre mudança de paleta era causado pelo Dark Reader junto ao modo
  escuro nativo. O usuário o desativou no Copy e confirmou a correção.
- A extensão inicialmente bloqueou upload local; o usuário habilitou acesso a
  URLs de arquivo. Se reaparecer, conferir a permissão sem tratar isso
  automaticamente como defeito do aplicativo.
- Pasta de downloads informada nesta conversa:
  `C:\Users\Luketes\Desktop\Nova pasta (2)`. Não apagar ou sobrescrever arquivos
  anteriores; distinguir nome, data, quantidade e conteúdo da exportação.

Evidências privadas, dumps e acessos estão em `.cache/vendas-copy/`, ignorado pelo
Git. Não publicar senhas, tokens, conexões com credenciais, fotos/comprovantes ou
dados pessoais. Os MDs públicos podem listar verificações e resultados agregados.

Os documentos de origem indicam, entre outros, `final-isolation-verification.json`,
`pagination-db-result.json`, `pagination-api-result.json`,
`export-files-result.json` e `lote2-visual-result.json`. São checkpoints; conferir
data e versão antes de reutilizá-los como evidência atual. Não executar scripts
privados sem ler seus efeitos, destino e requisitos.

## Critério para encerrar e comunicar um lote

Registrar problema, escopo aprovado, arquivos afetados, resultado da validação
local e visual, publicação efetiva no Copy, isolamento e limitações.
Não confundir commit/push com confirmação de deployment bem-sucedido.

Atualizar o roadmap para status e ordem; atualizar a baseline para resultados e
limites; atualizar o ambiente quando mudar infraestrutura ou condições de retomada.
Evitar copiar o histórico inteiro para cada arquivo.

Separar fato confirmado, hipótese, proposta e decisão aprovada. Não escolher
quantidades de itens, larguras globais ou reorganização de navegação como se o
usuário já tivesse decidido. Evidência suficiente deve encerrar a investigação.

Ao retomar com contexto reduzido, informar o último checkpoint, verificar apenas
o estado que pode ter mudado e continuar o próximo passo autorizado. Havendo
contradição entre documentos e comportamento atual, investigar a divergência
pontualmente e registrar a correção.
