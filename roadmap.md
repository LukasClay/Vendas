# Roadmap — UI/UX do painel ADM

> Checkpoint documental: 06/10/2026. Base principal:
> [baseline visual](docs/BASELINE_VISUAL_ADM.md) e
> [ambiente de testes](docs/AMBIENTE_TESTES_ADM.md), produzidos nesta conversa.
> Este roteiro registra entregas e propostas; não autoriza novos lotes,
> publicação em produção ou merge em `main`.

## Objetivo e limites

Melhorar organização, legibilidade, uso do espaço, responsividade e experiência
com grande volume de dados no painel ADM. Preservar a identidade visual, a paleta
e os temas existentes. O ADM é prioritariamente desktop, com uso móvel acessível.

Trabalho na branch `codex/adm-ui-ux`, com validação no
[Vendas Copy](https://vendas-copy-production.up.railway.app).
Vendedora e consultora ficam fora das alterações de produto; seus fluxos são
conferidos para detectar regressões quando o lote puder afetá-los.

As regras permanentes estão no [TODO.md](TODO.md). As instruções de retomada
estão em [qualidade de vida.md](<qualidade de vida.md>). Os detalhes técnicos do
clone continuam no documento de ambiente; não repetir sua preparação.

## Estado das etapas

| ID   | Etapa                                                         | Situação                    | Evidência e limite                                                                                                     |
| ---- | ------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PREP | Branch, banco copiado, storage privado e proteções do sandbox | Concluída no checkpoint     | Ambiente independente verificado; não equivale a paridade completa com produção.                                       |
| BASE | Baseline dos fluxos essenciais e telas representativas        | Concluída                   | Registro/arquivos da vendedora, conclusão pela consultora e verificações ADM; não cobre todos os estados das 13 telas. |
| L01  | Histórico completo, totais, categoria e exportações           | Publicado em produção       | Versão 2.19.0; Copy validado integralmente, consultas de produção conferidas em 06/10.                                 |
| L02  | Datas dos relatórios no celular                               | Publicado em produção       | Versão 2.19.1; matriz no Copy e 390 px efetivos de produção conferidos em 06/10.                                       |
| L03  | Legibilidade da tabela de Todas as Vendas no desktop          | Publicado em produção       | Versão 2.19.2; matriz no Copy e 1440 px efetivos de produção conferidos em 06/10.                                      |
| L04  | Dashboard: espaço útil, leitura e apresentação das filas      | Proposto; aguarda aprovação | Diagnóstico em nove larguras; decisão sobre prévia de seis itens e expansão ainda pendente.                            |
| CONS | Consolidar demais achados e cobertura das 13 telas            | Pendente de planejamento    | Os dois MDs de origem registram uma baseline representativa; não constituem o backlog completo da auditoria ampla.     |
| PROD | Entrega em produção                                           | Concluída em 06/10/2026     | Main `019da5e`, deployment `1fbdf1dd` SUCCESS, 2/2 réplicas, healthcheck e consultas aprovados; CI completo aprovado.  |

### L01 — consulta completa do histórico ADM

Problema registrado: a tela mostrava somente 200 vendas, sem paginação, com
categoria filtrada após esse corte e indicação ambígua de total.

Entrega autorizada e validada:

- 50 vendas por página, navegação e reinício da página ao mudar filtros;
- categoria no servidor, total e soma do universo filtrado;
- Excel/PDF com todos os resultados filtrados, até 5.000 vendas; acima disso,
  recusa explícita e solicitação para restringir filtros;
- consultas administrativas próprias, preservando os consumidores de `sales.list`
  e os limites dos outros perfis.

Evidência: 239 testes de backend, typecheck/build, 65 comparações SQL e 137
verificações da API publicada. Interface em 390, 768 e 1440 px. Dois arquivos
Excel e um PDF completo comparados às 2.702 vendas ativas do clone, com total de
R$ 457.299,23. O PDF teve 197 páginas e conferência visual de páginas selecionadas.

Detalhes, arquivos afetados e limitações:
[primeiro lote na baseline](docs/BASELINE_VISUAL_ADM.md#primeiro-lote-aprovado-consulta-completa-do-histórico-adm).
Rolagem horizontal interna da tabela permaneceu; L01 não redesenhou suas colunas.

### L02 — datas dos relatórios móveis

Problema reproduzido: em 390 px, o segundo campo ultrapassava a viewport,
terminando aproximadamente em 418 px.

Entrega autorizada e validada:

- datas em coluna abaixo de 640 px e duas colunas nas telas maiores;
- labels associados “Início” e “Fim”;
- largura limitada ao contêiner e fonte de 16 px no celular;
- seletor nativo, paleta, handlers, queries e exportações preservados.

Evidência: typecheck/build e 239 testes aprovados. Chrome em 320, 390, 768 e
1440 px, sem corte das datas ou overflow horizontal da página. Período manual de
setembro, Hoje e limpar filtros conferidos. Isso não confirma aparelho físico,
calendário/teclado de iPhone ou viradas de dia e semana.

Detalhes:
[segundo lote na baseline](docs/BASELINE_VISUAL_ADM.md#segundo-lote-campos-de-data-dos-relatórios).

### L03 — implementado e validado no Copy

Em 30/09/2026, após a consolidação destes documentos, o usuário pediu
“perfeito, prossiga”. A continuidade autoriza o lote sugerido na conversa:
legibilidade da tabela ADM, na mesma branch e somente no Copy. Produção e
alterações nos outros perfis continuam fora do escopo.

Objetivo: melhorar a leitura de Todas as Vendas no desktop, preservando todos
os dados, ações e resultados de L01.

Evidência de origem: a baseline mediu tabela de aproximadamente 1.251 px dentro
de um contêiner de 1.128 px em 1440 px; a validação de L01 confirmou que a rolagem
interna permanece. Antes de decidir medidas, conferir a versão efetiva no Copy.

Sequência de execução:

1. Medir largura útil, colunas, textos longos e acesso às ações no layout atual.
2. Apresentar o ajuste de largura, espaçamento e quebra de texto necessário,
   com arquivos afetados e impacto de eventuais componentes compartilhados.
3. Implementar o ajuste restrito à página e validar por etapa no Copy.
4. Conferir filtros, paginação, detalhes e acesso às exportações. Reabrir a
   comparação de conteúdo das exportações se sua geração ou seleção mudar.

Critérios de aceite propostos:

- mais espaço útil e leitura adequada em desktop e notebook;
- nenhuma informação ou ação removida ou ocultada sem decisão explícita;
- ausência de overflow da página; rolagem interna residual, se necessária,
  deve ser avaliada por usabilidade, sem prometer sua eliminação em toda largura;
- controles utilizáveis em tablet/celular e identidade visual preservada;
- consultas, total, soma e paginação de L01 preservados;
- isolamento do Copy mantido e alterações restritas ao ADM.

Conferência inicial: em 1440 px, tabela de 1.205 px dentro de 1.128 px; nomes
com largura útil de aproximadamente 85 px e linha mais alta de 189 px na primeira
página. Em 2560 px, o conteúdo fica limitado a 1.600 px apesar de haver cerca de
2.248 px úteis. Essas são medidas desta rodada, não substituições dos registros
históricos da baseline.

Ajuste implementado: largura disponível somente nesta página, padding
lateral de 16 px nas células, tabela com colunas estáveis e cliente/trabalho
usando o espaço restante, texto integral com quebra e ações fixas à direita.
Largura mínima de 1.200 px validada nas larguras conferidas no Copy, com rolagem
interna nas larguras menores. Navegação, paleta, queries e componentes
compartilhados preservados.

Versão publicada: 2.19.2, commit histórico `5a30805`, deployment Copy
`a6e739e2-ab71-408f-9f4d-0bb8c3b5e4cf` com `SUCCESS`. Typecheck, build e 239 testes
aprovados; visual em 320, 390, 768, 1024, 1280, 1366, 1440, 1600, 1920 e 2560 px,
sem overflow da página. Em 1440 px, maior linha da primeira página de 189 para
133 px; em ultrawide, largura útil de 1598 para 2248 px. Conteúdo/links/quantidade
de ações das 50 linhas preservados. Paginação, filtro de categoria, resultado
vazio, detalhes e abertura/cancelamento da edição conferidos. Isolamento e
integridade aprovados. Arquivos exportados não foram reinspecionados, pois seleção
e geração não mudaram. Rolagem interna permanece: 72 px em 1440 px.

Detalhes e limites:
[terceiro lote na baseline](docs/BASELINE_VISUAL_ADM.md#terceiro-lote-legibilidade-da-tabela-de-vendas-no-desktop).

### L04 — Dashboard: proposto, aguardando aprovação

O “Prossiga” após L03 autorizou recuperar os achados, conferir o Copy e preparar
o lote antes de implementar. Diagnóstico concluído em 30/09/2026 na versão
2.19.2; nenhum código, commit, push ou deployment nesta preparação.

Problema confirmado: 29 trabalhos para escrever e 69 pendentes são renderizados
integralmente no Dashboard. Em 1440 px, o card de pendentes tem 2706 px de altura;
em 768 px, os cards têm apenas 221 px de largura e a página chega a 10948 px.
Em ultrawide, o conteúdo continua limitado a 1152 px. As filas são independentes
do período financeiro, mas essa distinção não é explicitada na interface.

Evidências, matriz de larguras e limites do diagnóstico:
[preparação do L04 na baseline](docs/BASELINE_VISUAL_ADM.md#preparação-do-l04-dashboard-com-filas-extensas).

**Proposta recomendada, ainda não aprovada:**

1. Ampliar a largura útil exclusivamente no Dashboard, mantendo hierarquia,
   identidade e paleta. Definir o limite final com medidas do protótipo,
   evitando apenas esticar textos e gráficos em ultrawide.
2. Exibir a contagem integral de cada fila e indicar “Fila atual · todos os
   períodos”. Separar cliente e trabalho; preservar o texto completo, prazos
   e urgência, com quebra adequada e ícones sem compressão.
3. Mostrar inicialmente **seis itens por fila**, mantendo a ordem atual da
   consulta. Disponibilizar “Mostrar todos os N” no próprio Dashboard e
   “Mostrar menos”, com estado acessível ao teclado. A expansão mantém acesso
   integral aos dados já recebidos, inclusive se houver mais de 500 itens;
   o crescimento da página após essa ação será uma escolha explícita.
4. Acrescentar “Abrir painel” como atalho ao **Painel Trabalhos**, na aba
   correspondente. Dar suporte à seleção do status na rota ADM, inclusive
   ao voltar/navegar, sem mudar o comportamento padrão sem parâmetro.
5. Usar uma coluna nas larguras em que duas colunas prejudicam a leitura;
   validar o breakpoint com a largura efetiva após a sidebar.
6. Tratar loading, vazio real e erro da consulta de trabalhos separadamente
   das métricas financeiras, com opção de tentar novamente em caso de falha.

**Decisão de produto pendente:** aprovar a prévia de seis itens com expansão
ou preferir a fila inteira dentro de uma área de rolagem de altura limitada.
A prévia é recomendada para leitura rápida do resumo; a rolagem mantém a fila
inteira aberta, mas introduz uma região de rolagem adicional. Nenhum desses
comportamentos foi escolhido pelo usuário até este checkpoint.

Limite conhecido: o Painel Trabalhos retorna até 500 itens por fila. O atalho
será adicional, sem ser apresentado como acesso ilimitado. A expansão no
Dashboard evita remover acesso aos demais registros. Resolver o limite do
painel com consultas/paginação administrativas é uma pendência separada;
não alterar queries compartilhadas com a consultora neste lote.

Escopo previsto: `client/src/pages/admin/Dashboard.tsx`, seleção de aba em
`client/src/pages/admin/Trabalhos.tsx` e versão em `Configuracoes.tsx` quando
implementado. Nenhuma alteração no contrato de `consultora.worksSummary`,
nas regras de prazo, banco, formulários ou páginas de vendedora/consultora.
Reduzir itens renderizados inicialmente não reduz o payload da consulta.
SLA/metas, definições financeiras, atalhos UTC, sidebar e demais widgets não
recebem redesign ou mudança de regra neste lote.

Critérios de aceite propostos:

- contagens iguais às filas completas; seis itens inicialmente apenas quando
  houver mais de seis, sem confundir erro com zero;
- expandir/recolher preserva todos os registros e sua ordem, nomes, trabalhos,
  prazos e urgência; conferir 0, 1, 6, 7, 29/69 e mais de 500 em cenário
  controlado, sem modificar vendas históricas;
- atalho abre o status correto no ADM; rota sem parâmetro mantém o padrão,
  retorno e navegação continuam coerentes;
- SLA e demais cards ficam acessíveis sem atravessar as filas inteiras no
  estado inicial; ausência de overflow da página e leitura adequada em
  390, 768, 1024, 1280, 1366, 1440, 1600, 1920 e 2560 px;
- foco visível, expansão anunciada e texto integral acessível; identidade e
  tema nativo preservados;
- período financeiro continua alterando somente seus consumidores atuais;
  contagens/filas permanecem independentes e corretamente identificadas;
- typecheck, testes, build, formatação, diff e validação visual no Copy;
  isolamento reconferido antes da publicação, sem alterações em produção.

Próximo passo: apresentar este escopo para aprovação; depois implementar por
etapas na mesma branch e publicar somente no Copy se autorizado. Produção
continua exigindo aprovação específica. L04 preparado não conta como lote
implementado ou tela corrigida na medida de progresso.

### Revisão para entrega de L01–L03 em produção

Em 06/10/2026, o usuário autorizou a revisão final, sem autorizar publicação.
Diff revisado: dez commits / 21 arquivos contra `origin/main` atualizado.
Typecheck, build, 239 testes, cinco verificações adicionais de modo de produção,
formatação dos arquivos candidatos e diffcheck aprovados. Nenhum bloqueador
funcional encontrado; não houve mudança no código da aplicação nesta rodada.

Na revisão local, formatação global falhou em 175 arquivos fora do candidato.
A publicação esclareceu a causa: todos tinham CRLF no Windows e passam após
normalização LF em memória, sem alteração de arquivo. O CI completo do commit
publicado passou, incluindo formatação global. O Railway continua sem aguardar
checks do GitHub; sua configuração não foi alterada. Deployment anterior
disponível para retorno na conferência.

Conclusão, evidências, limites e sequência de publicação/retorno:
[revisão final na baseline](docs/BASELINE_VISUAL_ADM.md#revisão-final-antes-de-main--06102026).
Após uma entrega aprovada dos lotes concluídos, retomar L04 na branch/Copy;
essa revisão não aprova automaticamente o Dashboard.

Em 06/10/2026, após receber o resumo do caminho de entrega, o usuário respondeu
“perfeito, faça”: autorizou publicar L01–L03 em `main` e acompanhar o deploy,
aceitando explicitamente a pendência de formatação fora do diff para outro lote.
Verificações posteriores em produção ficam restritas a leitura. Documentos de
outras tarefas continuam excluídos. L04 não faz parte desta publicação.

Entrega concluída: `main` em `019da5e8ca1cacee677e08d7d7b4173b1128df29`, versão
2.19.2, deployment `1fbdf1dd-741c-414c-9e6b-3251c9428372` SUCCESS. Healthcheck 200,
duas réplicas online, liderança dos jobs iniciada e conferências visuais em leitura
aprovadas. Histórico e relatórios coincidem em 2.816 vendas / R$ 470.763,23 no
checkpoint. Formulário, catálogo, histórico pessoal e filas/foto da consultora
conferidos com a sessão ADM autorizada; não houve login separado desses perfis
nem envio de venda, upload ou alteração de status. Detalhes e limites na baseline.
Continuar futuros lotes na branch/Copy; L04 segue aguardando aprovação.

## Pendências recuperáveis dos documentos de origem

| Item                                          | Evidência disponível                                         | Próxima decisão ou validação                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Rolagem/legibilidade de Todas as Vendas       | Medição da baseline e resultado de L01                       | L03 concluído; rolagem interna residual é uma condição documentada, não um defeito automaticamente pendente.                |
| Atalhos de período com UTC nos relatórios     | Registrados como achado separado em L02                      | Conferir comportamento e critério de fuso nas viradas de dia/semana antes de propor correção; L02 não corrigiu essa lógica. |
| Auditoria completa das demais superfícies ADM | Escopo amplo permanece pendente de consolidação              | Recuperar achados já existentes e suas evidências; investigar apenas o que estiver ausente ou contraditório.                |
| Limite de 500 no Painel Trabalhos             | Queries compartilhadas `toWrite`/`pending` têm `.limit(500)` | Planejar consulta/paginação própria do ADM antes de prometer acesso ilimitado por esse painel; não cortar o Dashboard.      |
| Validação em aparelhos físicos e rede móvel   | Limitação explícita da baseline                              | Planejar quando relevante ao lote, sem afirmar que emulação de viewport cobre esses cenários.                               |
| Performance dos anexos em produção            | Mídia privada do clone difere de URL pública/CDN             | Avaliar essa diferença antes de uma entrega que afete anexos.                                                               |

## Cobertura documentada das 13 telas

Esta tabela reúne os registros recuperáveis dos dois MDs de origem e a
preparação atual de L04. Não afirma que as outras telas nunca foram analisadas
em uma passagem anterior. Há telas sem resultado detalhado nesses documentos.

| Tela ADM                    | Registro recuperável da validação no Copy                                                   | Implementação desta sequência                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Dashboard                   | L04 preparado: nove larguras, filas 29/69, períodos e dependências confirmados              | L04 proposto; nenhuma implementação.                              |
| Relatórios                  | Métricas, filtros, gráficos e responsividade representativos                                | L02 concluído; outras pendências continuam.                       |
| Todas as Vendas             | Lista, filtros, detalhes, paginação, exportações e responsividade                           | L01 e L03 concluídos.                                             |
| Nova Venda no ADM           | Sem resultado detalhado específico do ADM                                                   | Nenhum lote registrado; formulário pode afetar outros perfis.     |
| Trabalhos                   | Sem resultado detalhado nos MDs de origem                                                   | Nenhum lote registrado.                                           |
| Painel Trabalhos            | Abertura e abas 29/69 conferidas como destino do Dashboard; limite 500 confirmado no código | Atalho de status proposto em L04; sem auditoria completa da tela. |
| Consultas administrativas   | Sem resultado detalhado nos MDs de origem                                                   | Nenhum lote registrado.                                           |
| Alertas                     | Sem resultado detalhado nos MDs de origem                                                   | Nenhum lote registrado.                                           |
| Cadastros                   | Busca, segunda página/retorno, ficha e histórico vinculado                                  | Nenhum lote registrado.                                           |
| Funcionários                | Sem resultado detalhado nos MDs de origem                                                   | Nenhum lote registrado.                                           |
| Lixeira                     | Sem validação visual detalhada; teste técnico de soft delete/restauração não a substitui    | Nenhum lote registrado.                                           |
| Segurança                   | Sem resultado detalhado de UI nos MDs de origem                                             | Nenhum lote registrado.                                           |
| Minha Conta / Configurações | Atualização do número da versão; não é uma auditoria da tela                                | Nenhum lote de UI registrado.                                     |

Sidebar, componentes compartilhados, modais, formulários e estados de
loading/vazio/erro também pertencem ao escopo amplo. A cobertura deve registrar
as verificações concretas, sem concluir qualidade apenas porque uma tela abriu.

## Progresso e próximos lotes

- Três lotes de UI/UX validados, em duas das 13 telas: aproximadamente 15%
  por contagem de telas que receberam alguma correção.
- Isso não mede o esforço total nem significa que essas duas telas estão
  inteiramente concluídas. Preparação do clone não entra nessa porcentagem.
- Não há backlog completo, dimensionado e com pesos suficientes para calcular
  uma porcentagem global confiável.
- Antes de estimar o total, consolidar achados em itens com evidência,
  prioridade, escopo, dependências, critérios de aceite e aprovação.

Para cada lote futuro, registrar: ID, problema confirmado, evidência, proposta,
decisão humana, arquivos/perfis afetados, verificações necessárias, resultado
local, publicação efetiva no Copy e limitações. Manter separados os estados
“proposto”, “aprovado”, “implementado”, “validado no Copy” e “publicado em produção”.

## Atualização deste roteiro

Ao concluir um lote, atualizar sua linha e os critérios realmente satisfeitos,
com link para as evidências na baseline. Atualizar o documento de ambiente apenas
quando o ambiente ou suas condições de retomada mudarem. SHAs e deployments são
checkpoints históricos; o estado atual deve ser consultado no Git/Railway.
