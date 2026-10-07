# Baseline visual do Vendas Copy — 30/09/2026

## Ambiente e alcance

Verificação representativa dos fluxos essenciais antes dos lotes de UI/UX.
Destino: `https://vendas-copy-production.up.railway.app`, branch
`codex/adm-ui-ux`, código publicado no commit histórico `de6a04f`.
Produção foi consultada somente na conferência de isolamento do Railway;
nenhuma operação de escrita ou deployment de produção foi realizada.

Chrome do usuário, com viewport de 390 × 844 para os fluxos móveis; verificação
adicional da consultora em 360 × 800, e do ADM em 768 × 1024 e 1440 × 900.
Dark Reader desativado pelo usuário no Copy. Tema nativo escuro do ADM e paleta
própria dos outros perfis preservados. Durante a baseline, nenhum código de
UI/UX foi alterado; a implementação posterior do primeiro lote está abaixo.

Não equivale a testes em aparelho físico, câmera, conexão móvel lenta, todos
os navegadores, todos os estados de todas as telas ou auditoria completa de
acessibilidade. Os resultados abaixo identificam exatamente o que foi validado.

## Fluxos executados

| Área             | Conferência                                                                   | Resultado                                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vendedora        | Login, preenchimento, máscaras de data/valor e seleção do trabalho individual | Funcionou em 390 px, sem overflow horizontal no formulário.                                                                                                                                                                              |
| Vendedora        | Upload de comprovante e duas fotos fictícias, envio da venda                  | Venda registrada com sucesso; confirmação exibiu as duas ações seguintes. Não foi testada uma segunda venda para o mesmo cliente nesta rodada.                                                                                           |
| Vendedora        | Histórico e abertura do comprovante privado                                   | Venda apareceu no histórico; imagem de 800 × 600 carregou após login.                                                                                                                                                                    |
| Consultora       | Busca da venda fictícia, abertura e carregamento das duas fotos               | Funcionou; arquivos privados carregaram e o download da primeira foto foi confirmado.                                                                                                                                                    |
| Consultora       | `para_escrever → pendente → feito`, com confirmação pela interface            | Funcionou; estado `feito` conferido também no banco de teste.                                                                                                                                                                            |
| Consultora       | Histórico concluído em 360 px                                                 | Fotos carregadas, sem overflow horizontal.                                                                                                                                                                                               |
| ADM / Vendas     | Lista com volume copiado, filtros de data/vendedora/categoria, detalhes       | Filtros isolaram a venda de R$ 1,00; detalhes exibiram status e três anexos. Encontrada limitação de 200 registros sem paginação.                                                                                                        |
| ADM / Vendas     | Desktop, tablet e celular                                                     | Cards e detalhes funcionaram em 390 px. Tabela possui rolagem horizontal interna, inclusive em 1440 px.                                                                                                                                  |
| ADM / Cadastros  | Avançar à segunda página e voltar, busca, ficha e histórico vinculado         | Funcionou. Segunda página confirmou 20 linhas diferentes e controle de retorno habilitado. Ficha fictícia funcionou em 390 px.                                                                                                           |
| ADM / Relatórios | Carregamento das métricas, período Hoje e modo Quantidade dos gráficos        | Hoje mostrou 1 venda / R$ 1,00. Gráfico anual mudou para Quantidade; mantém o período anual indicado no título.                                                                                                                          |
| ADM / Relatórios | Responsividade de período                                                     | Defeito reproduzido em 390 px: segundo campo cortado, largura da página de 418 px. Em 768 px não houve overflow da página nessa conferência.                                                                                             |
| ADM / Vendas     | Excel/PDF da venda fictícia filtrada                                          | Ações acionadas; PDF exibiu confirmação de 1 venda exportada. A ferramenta não capturou os downloads gerados pelo cliente. Não foi possível inspecionar o conteúdo final dos arquivos; não considerar essa parte aprovada integralmente. |

A permissão de arquivos da extensão inicialmente bloqueou o upload. O usuário
habilitou “Permitir acesso a URLs de arquivo”; comprovante e fotos foram
carregados na retomada. Esse bloqueio não foi uma falha da aplicação.

## Problemas confirmados e prioridade

### 1. Histórico incompleto e indicação ambígua de total

A tela solicitou `limit: 200`, renderizou 200 linhas e mostrou “Total de registros:
200”, sem controle para consultar a página seguinte. O resumo dos relatórios,
no mesmo clone, indicou 2.703 vendas ativas durante a presença da venda fictícia.
Não confundir vendas ativas com as 2.732 linhas totais do snapshot, que incluem
registros excluídos.

Confirmação no código: `client/src/pages/admin/Vendas.tsx` fixa o limite em 200
sem offset. `sales.list` aceita offset no backend, mas a tela não o utiliza.
O filtro de categoria atua no cliente depois desse limite. Portanto, uma
categoria pode omitir vendas mais antigas que atendam ao filtro.

Os geradores Excel/PDF dessa tela também usam `salesData`. Pela inspeção do
código, ficam limitados à seleção retornada; isso não constitui validação dos
arquivos baixados. A soma do rodapé corresponde aos registros carregados, e
não pode ser apresentada como soma de todo o universo filtrado.

### 2. Campo de data cortado nos relatórios móveis

Em 390 px, o segundo campo termina em aproximadamente 418 px. Os inputs
compartilham uma linha flexível e mantêm sua largura mínima nativa. A captura
confirma o corte. Ajuste proposto em lote visual separado: organizar as datas
em coluna nas larguras estreitas e manter a disposição horizontal no desktop,
com labels associados e largura que respeite o contêiner.

### 3. Leitura da tabela no desktop

Em 1440 px, a tabela mediu aproximadamente 1.251 px dentro de um contêiner de
1.128 px. Em 768 px, aproximadamente 1.106 px dentro de 462 px, com rolagem
horizontal interna. Essa rolagem preserva acesso às colunas, mas exige avaliação
do uso do espaço e da legibilidade no lote visual; não demonstra perda de dados.

## Primeiro lote aprovado: consulta completa do histórico ADM

O usuário autorizou implementar e testar este lote somente no Copy. Versão
`2.19.0` publicada e validada no deployment de teste.

1. Consultar 50 vendas por página no servidor, com ordem determinística,
   avanço/retorno e reset da página ao alterar filtros.
2. Aplicar a categoria no servidor antes da paginação, preservando a semântica
   atual de categorias e os demais filtros.
3. Mostrar total real do filtro e separar a soma da página da soma total.
4. Exportar todos os resultados filtrados, preservando um limite explícito e
   recusando truncamento silencioso. Não transformar a exportação em “somente
   a página atual” sem indicação clara.
5. Preservar `sales.list` para seus outros consumidores, os limites de acesso,
   sanitização das mídias, invalidação SSE e queries dos outros perfis. Não
   alterar banco, jobs, dependências ou arquivos de vendedora/consultora.

Arquivos do lote: `client/src/pages/admin/Vendas.tsx`, consultas/rotas ADM
em `server/db.ts` e `server/routers/sales.ts`, e a invalidação ADM em
`client/src/hooks/useAdminSSE.ts` caso haja query nova. Atualizar versão e
continuidade conforme o guia do projeto; verificar o diff final antes de
publicar apenas no Copy. As consultas novas `sales.pagedList` e
`sales.exportRows` são restritas ao ADM. Exportações permitem até 5.000 vendas;
acima disso o servidor recusa a operação e solicita restringir os filtros.

Validação local aprovada: typecheck, build e 239 testes de backend, incluindo
13 novos casos de paginação, filtros, sanitização, autorização e limite de
exportação. Mais 65 comparações somente leitura no banco do clone conferiram
as 2.702 vendas ativas, três categorias, offsets após os primeiros 200 registros,
última página, resultado vazio, somas e filtro composto. Formatação dos arquivos
do lote e `git diff --check` aprovados; a formatação global tem divergências
preexistentes e não foi aplicada a arquivos fora do escopo.

Aceitação: acessar registros posteriores aos primeiros 200; categorias e
totais coincidirem com leitura independente do banco do clone; filtros
reiniciarem a paginação; última página e resultado vazio funcionarem;
exportação coincidir com todos os resultados do filtro; perfis não ADM
continuarem sem acesso às consultas administrativas. Testar typecheck, build,
testes pontuais de autorização/consulta e validar visualmente a versão no Copy
nas três larguras do ADM, com nova conferência dos fluxos prioritários.

### Resultado da implementação e validação publicada

Commit de código histórico `d9a0065c00acc46a55246c5a761980f05626341c`;
deployment Copy `2aeb2e7d-33f9-4af3-b642-5f36837a24d1`, `SUCCESS`.
Atualizações documentais posteriores podem gerar outro deployment do mesmo
código; consultar o Railway antes de operações importantes.

- A API publicada passou 137 verificações contra SQL independente, incluindo
  três categorias, páginas inicial/intermediária/final/vazia, soma, exportação
  completa, filtros compostos, limites de entrada e bloqueio dos outros perfis.
  Categorias: 300 Individual, 924 Promoção e 1.478 Coletivo. Mais 22 verificações
  de login, consultas e autorização dos três perfis passaram após o deploy.
- Pela interface: 50 linhas, 2.702 registros, 55 páginas, total filtrado de
  R$ 457.299,23; primeira e segunda páginas têm registros diferentes. Página 6
  acessa registros 251–300, ultrapassando o antigo limite. Categoria Individual
  reinicia em página 1, termina em página 6 com Próxima desabilitada; limpar
  filtros reinicia o histórico completo. Data futura produz 0 registros,
  somas zeradas e navegação desabilitada. Avançar/voltar funciona no celular.
- Resumo e navegação conferidos em 390, 768 e 1440 px, sem overflow horizontal
  da página. Rolagem interna da tabela permanece; o lote não redesenhou colunas.
- Excel/PDF da interface confirmaram 2.702 vendas. A ferramenta não capturou o
  evento de download e bloqueou `chrome://downloads`; não houve contorno desse
  bloqueio. O usuário informou a pasta dos arquivos, permitindo analisar
  diretamente as exportações locais disponibilizadas por ele.
- Dois arquivos Excel completos têm 2.702 linhas e 10 colunas, com todos os
  campos e ordem coincidentes com SQL independente. PDF tem 197 páginas e
  2.702 linhas; datas e valores ordenados, soma e contagem coincidem com o banco.
  Renderização conferida nas páginas 1, 99 e 197. Arquivos da baseline com
  apenas uma venda foram distinguidos das exportações novas; não foram alterados.
- Regressão móvel posterior: formulário da vendedora e filas/detalhes da
  consultora, incluindo carregamento de foto privada, conferidos sem alteração
  de vendas históricas. O fluxo completo
  com registro e conclusão fictícios é a baseline anterior a este lote; não
  afirmar uma segunda venda completa após o deploy.
- Integridade comercial do clone, 2.823 objetos privados e 403 da chave de
  teste no bucket de produção reconfirmados. Jobs bloqueados. Deployment,
  commit e configuração de produção permaneceram iguais à baseline.

Evidências adicionais privadas: `pagination-db-result.json`,
`pagination-api-result.json`, `export-files-result.json`,
`lote1-adm-desktop.jpg`, `lote1-adm-tablet.jpg`, `lote1-adm-mobile.jpg` e
renders `lote1-export-pdf-*`. Nenhuma evidência com dados de clientes vai ao Git.

## Segundo lote: campos de data dos relatórios

O usuário autorizou prosseguir com o próximo lote sugerido. Versão `2.19.1`,
commit de código histórico `a20b16eb3b26a185d3e10694eb599ba57ea8149d`, publicada
somente no Copy, deployment `d1a01c13-9512-41c4-80c5-6babc00c0363` com `SUCCESS`.

Correção limitada a `Relatorios.tsx` e ao número da versão em `Configuracoes.tsx`.
Campos Início/Fim com labels associados, uma coluna abaixo de 640 px e duas
colunas nas telas maiores. Inputs respeitam a largura disponível, com fonte de
16 px no celular. Paleta e seletor nativo preservados. Handlers, queries,
exportações e componentes dos outros perfis não foram alterados.

- Reproduzido o corte anterior: segundo input terminava em 418 px em 390 px.
- Validação no Chrome em 320, 390, 768 e 1440 px: ambos os campos ficam dentro
  da viewport, sem overflow horizontal da página. Fonte calculada de 16 px no
  celular e 14 px em telas maiores; coluna no celular e mesma linha no tablet
  e desktop. Labels Início/Fim localizados pela árvore de acessibilidade.
- Preenchimento pelo teclado de 01/09/2026 a 30/09/2026 retornou 427 vendas /
  R$ 66.138,57. Hoje retornou zero no snapshot sem a venda fictícia; limpar os
  filtros retornou 2.702 vendas / R$ 457.299,23.
- Typecheck, build, 239 testes, formatação dos arquivos alterados e diffcheck
  aprovados. Integridade comercial, arquivos privados, jobs bloqueados e
  configuração/deployment de produção reconfirmados após a publicação.
- Sem novo registro de venda ou alteração de dados comerciais nesta rodada.
  Teste em viewport de desktop não confirma seletor/calendário, zoom ou teclado
  de iPhone físico. A lógica UTC dos atalhos permanece um achado separado;
  esta conferência não testou a virada de dia ou semana.

Evidências privadas: `lote2-relatorios-before.jpg`,
`lote2-relatorios-mobile.jpg`, `lote2-relatorios-desktop.jpg` e
`lote2-visual-result.json`. Mudanças documentais posteriores podem gerar outro
deployment do mesmo código; verificar o Railway antes de novas operações.

## Terceiro lote: legibilidade da tabela de vendas no desktop

O usuário autorizou prosseguir após a consolidação do roadmap e do guia de
continuidade. Versão `2.19.2`, commit de código histórico
`5a30805512368eb7158534300633e8565f3c73b3`, deployment Copy
`a6e739e2-ab71-408f-9f4d-0bb8c3b5e4cf` com `SUCCESS`.

Mudanças restritas a `Vendas.tsx` e ao número da versão em `Configuracoes.tsx`:
conteúdo utiliza a largura disponível, tabela com colunas estáveis, padding
lateral de 16 px, cliente/trabalho com texto integral e quebra, vendedor com
quebra quando necessário. Coluna de ações permanece fixa à direita. Região de
rolagem acessível ao teclado, headers associados por `scope` e nomes acessíveis
nos botões de editar/excluir. Paleta, cards móveis, filtros, queries, geradores
de exportação e componentes compartilhados não foram alterados.

Medições da primeira página com 50 vendas, no mesmo clone:

| Viewport | Largura útil da tabela | Largura da tabela     | Maior linha antes → depois                               |
| -------- | ---------------------- | --------------------- | -------------------------------------------------------- |
| 2560 px  | 1598 → 2248 px         | 1598 → 2248 px        | 89 → 75 px                                               |
| 1920 px  | 1598 → 1608 px         | 1598 → 1608 px        | 89 → 93 px                                               |
| 1600 px  | 1288 px após o ajuste  | 1288 px após o ajuste | 113 px após o ajuste; sem medição anterior nesta largura |
| 1440 px  | 1128 px                | 1205 → 1200 px        | 189 → 133 px                                             |
| 1366 px  | 1054 px                | 1205 → 1200 px        | 189 → 133 px                                             |
| 1280 px  | 968 px                 | 1205 → 1200 px        | 189 → 133 px                                             |
| 1024 px  | 712 px                 | 1205 → 1200 px        | 189 → 133 px                                             |
| 768 px   | 456 px                 | 1205 → 1200 px        | 189 → 133 px                                             |

Em 1440 px, cliente passou de aproximadamente 133 para 178 px de coluna,
com largura útil de texto de 85 para 146 px. Trabalho passou de 144 para 178 px.
As linhas não ficaram menores em todas as larguras: em 1920 px, a maior linha
passou de 89 para 93 px devido à nova distribuição/quebra. A melhoria principal
é a previsibilidade e a leitura nas larguras comprimidas.

- Nenhum overflow horizontal da página em 320, 390, 768, 1024, 1280, 1366,
  1440, 1600, 1920 e 2560 px. Em 320/390 px, cards móveis e paginação
  permanecem acessíveis. Mesmos cards, sem redesign.
- Rolagem interna permanece abaixo da largura necessária: 72 px em 1440 px,
  por exemplo. Teclado alcançou o final da rolagem, com foco visível. As quatro
  ações da primeira linha ficaram dentro da região nas larguras de tabela.
- Comparação privada dos 50 registros antes/depois confirmou mesmas células,
  links de anexos e quantidade de ações. Nenhuma informação do cliente/trabalho
  foi truncada pela nova tabela.
- Página 2 exibiu 51–100 de 2702, com registros diferentes; total filtrado
  R$ 457.299,23 e soma da segunda página R$ 8.048,31. Categoria Individual
  reiniciou em página 1 de 6, com 300 registros e R$ 158.151,25. Limpar retornou
  à primeira página completa. Avançar/voltar conferido também no celular.
- Filtro por data futura, aplicado pelo teclado nativo, mostrou zero registros,
  somas zeradas e “Nenhuma venda encontrada”. Detalhes abriram; edição abriu e
  foi cancelada, sem salvar. Excel/PDF permaneceram habilitados com filtro.
  Não foram gerados ou reinspecionados arquivos neste lote: seleção e geração
  não mudaram, e a validação de conteúdo de L01 continua sendo a evidência.
- Typecheck, build, 239 testes de backend, formatação dos arquivos do lote e
  diffcheck aprovados. Nenhuma query, alteração de banco, dependência ou arquivo
  dos painéis de vendedora/consultora neste lote; não houve novo fluxo completo
  de escrita desses perfis.
- Conferência posterior confirmou integridade comercial do snapshot,
  2.823 objetos privados, bloqueio de acesso ao bucket de produção com a chave
  de teste, jobs desabilitados e configuração/deployment de produção inalterados.

Evidências privadas em `.cache/vendas-copy/`: `lote3-before-metrics.json`,
`lote3-content-before.private.json`, `lote3-visual-result.json`,
`lote3-before-desktop.jpg`, `lote3-after-desktop.jpg` e `lote3-after-wide.jpg`.
Atualização documental posterior pode gerar novo deployment do mesmo código;
conferir o Railway antes de operações importantes.

## Preparação do L04: Dashboard com filas extensas

Diagnóstico em 30/09/2026, no Chrome autenticado do Copy, versão `2.19.2`.
O usuário autorizou preparar a proposta após L03; esta rodada não implementou
código, não criou dados comerciais e não publicou commit ou deployment.
O registro detalhado da antiga auditoria do Dashboard não foi recuperado nos
MDs desta conversa. Os achados abaixo vêm desta reprodução e do código atual,
sem tratar avaliações anteriores como decisões aprovadas.

O período inicial de setembro apresentou 427 vendas / R$ 66.138,57. O filtro
Total apresentou 2.702 vendas / R$ 457.299,23. Nos dois períodos, as filas
operacionais mantiveram 29 trabalhos para escrever e 69 pendentes. Elas são
filas atuais, independentes do período financeiro. A comparação foi feita
após o carregamento e a animação dos números, sem interpretar valores
intermediários como resultados finais.

Medições com o período de setembro e essas mesmas filas:

| Viewport | Conteúdo útil | Altura da página | Card para escrever: largura / altura | Card pendentes: largura / altura |
| -------- | ------------- | ---------------- | ------------------------------------ | -------------------------------- |
| 2560 px  | 1152 px       | 4422 px          | 568 / 1246 px                        | 568 / 2646 px                    |
| 1920 px  | 1152 px       | 4422 px          | 568 / 1246 px                        | 568 / 2646 px                    |
| 1600 px  | 1152 px       | 4422 px          | 568 / 1246 px                        | 568 / 2646 px                    |
| 1440 px  | 1130 px       | 4482 px          | 557 / 1266 px                        | 557 / 2706 px                    |
| 1366 px  | 1056 px       | 4762 px          | 520 / 1306 px                        | 520 / 2986 px                    |
| 1280 px  | 970 px        | 5114 px          | 477 / 1366 px                        | 477 / 3306 px                    |
| 1024 px  | 714 px        | 6012 px          | 349 / 1706 px                        | 349 / 3986 px                    |
| 768 px   | 458 px        | 10948 px         | 221 / 2730 px                        | 221 / 8086 px                    |
| 390 px   | 352 px        | 8901 px          | 352 / 1706 px                        | 352 / 3986 px                    |

Não houve overflow horizontal da página nessas nove larguras. Isso não torna
a leitura adequada: em 768 px, as duas colunas estreitas produziram linhas de
até 120/180 px. Em 1440 px, o SLA começou aproximadamente em 3684 px, e a
diferença entre os dois cards deixou cerca de 1440 px vazios sob o menor.
Em 2560 px, o conteúdo permanece limitado a 1152 px apesar de haver cerca de
2250 px disponíveis após sidebar e padding.

Achados confirmados e prioridades propostas para planejamento:

- **Alta: filas inteiras no resumo.** `Dashboard.tsx` renderiza todos os itens
  de `consultora.worksSummary`, sem limite visual; os cards não têm links ou
  botões de acesso à operação. O crescimento empurra SLA, metas, melhores
  clientes e vendas recentes para baixo. Não houve perda de dados nesta rodada.
- **Alta: duas colunas comprimidas no tablet.** A grade passa a duas colunas
  a partir de 768 px, enquanto a sidebar continua ocupando parte da largura.
- **Média: largura e leitura dos itens.** Limite `max-w-6xl`, cliente e trabalho
  unidos em um parágrafo e prazo disputando largura agravam a quebra de texto.
- **Média: contexto do período.** As filas não informam que independem dos
  filtros de vendas. A independência foi confirmada, não é um erro de cálculo.
- **Média: feedback da consulta de trabalhos.** Pelo código, os cards usam
  `isLoading` da consulta financeira; o estado próprio de loading/erro de
  `worksSummary` não é tratado. Um erro pode resultar em mensagem de fila
  vazia. Esse cenário de falha não foi provocado no navegador.

Dependência importante: `worksSummary` pertence ao router da consultora e
autoriza ADM/consultora, mas seu único consumidor atual encontrado é o
Dashboard. Retorna as filas sem corte; preservá-lo neste lote visual.
O destino operacional correto é **Painel Trabalhos**, `/admin/trabalhos`;
**Trabalhos** no menu é o catálogo, `/admin/produtos`.
O painel abriu com 29/69 itens nas abas correspondentes, sem executar ações.
Ele inicia sempre em Para Escrever e suas queries `toWrite`/`pending`, usadas
também pela consultora, têm limite de 500. Esse corte foi confirmado no código, não reproduzido com o
volume atual. Portanto, um atalho para esse painel não pode ser a única forma
de acessar itens ocultados pela prévia nem prometer acesso ilimitado.

Proposta e decisão de produto pendente estão no
[L04 do roadmap](../roadmap.md#l04--dashboard-proposto-aguardando-aprovação).
Melhores Clientes e Vendas Recentes já exibem seis itens; Top Vendedores teve
quatro em setembro e sete no histórico completo. Não há evidência nesta rodada
para aplicar o mesmo corte indiscriminadamente a todos os widgets.

Evidências privadas em `.cache/vendas-copy/`:
`dashboard-baseline-measures.json` e `dashboard-baseline-1440.jpg`.
Captura e dados pessoais permanecem fora do Git. Diagnóstico representativo,
sem teste de aparelho físico, rede lenta, falha de API ou auditoria completa
de todas as métricas do Dashboard. Override de viewport restaurado ao final.

## Revisão final antes de main — 06/10/2026

O usuário autorizou a revisão final para avaliar uma entrega dos lotes L01–L03.
Esta autorização não inclui merge, push, deploy, alterações de configuração ou
escrita em produção. Nenhuma dessas ações foi realizada.

Candidato revisado: commit histórico `0df2d5fb0b82b1d8ec3fb055f2ac1a9e9657a9ed`
da branch `codex/adm-ui-ux`, contra `origin/main` atualizado por fetch,
`e409a3c4d5e197243aabba139c0bc8741413cc60`. São dez commits e 21 arquivos;
`main` não tem commits exclusivos nessa comparação. O código da aplicação no
workspace coincide com o candidato; alterações locais pendentes são documentais.
L04 permanece somente proposto. `TODO.md`, `docs/historico.md` e o arquivo
`Qualidade de vida plugin gpt.md` continuam pertencendo a outro trabalho.

Conclusão: **nenhum bloqueador funcional encontrado no diff revisado, com
pendência na validação global do repositório**. Os lotes concluídos podem compor
uma entrega controlada, sujeita à aprovação de produção e ao tratamento explícito
da pendência de CI abaixo. Isso não equivale a garantia de ausência de regressões.

| Área                    | Resultado da revisão                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vendedora/consultora    | Sem alteração direta nas telas, rotas ou formulário compartilhado. `getSalesBySeller` permanece igual. Consultas normais da consultora não foram modificadas.                       |
| Histórico ADM           | Novos endpoints restritos a ADM; paginação e totais usam transação somente leitura. O contrato anterior de `sales.list` permanece, com desempate por ID na ordenação compartilhada. |
| Backend compartilhado   | Banco/storage/jobs/envios entram no comportamento de sandbox somente com `VENDAS_SANDBOX_MODE=1`. A rota de mídia privada fica desativada sem opt-in.                               |
| Schema e infraestrutura | Nenhuma migração, mudança de schema, dependência, credencial ou configuração de deploy no diff. Banco/bucket do Copy não acompanham um merge de código.                             |
| UI ADM                  | Datas dos relatórios e tabela de vendas revisadas; sem mudança adicional no Dashboard ou componentes visuais compartilhados.                                                        |

Verificações locais novas, em 06/10/2026:

- typecheck e build aprovados; 239 testes em 31 arquivos aprovados;
- cinco verificações adicionais aprovadas com `NODE_ENV=production` e variáveis
  de sandbox ausentes: uploads de fotos/comprovantes com URLs públicas, download,
  push individual, push para consultora e fallback de notificação sem Manus;
  provedores externos e banco simulados, sem upload/envio/consulta reais;
- formatação dos 21 arquivos candidatos e diffcheck aprovados;
- `pnpm run format:check` global falhou em **175 arquivos fora do diff candidato**.
  Inclui arquivos sem alteração frente à base, como `package.json`,
  `tsconfig.json` e `.prettierrc`. Não foram formatados arquivos fora do escopo.

Limite de CI: `.github/workflows/verify.yml` executa `pnpm verify`, que inclui
a formatação global. Portanto, não afirmar CI completo aprovado. O serviço
Railway de produção está com `source.checkSuites=false`; não espera os checks
do GitHub antes de publicar uma atualização de `main`. A pendência de formatação
precisa ser tratada em escopo próprio ou aceita explicitamente na decisão de
entrega com as verificações específicas documentadas. Não alterar o CI ou a
configuração do Railway silenciosamente para contornar isso.

Railway conferido somente em leitura: produção segue em `main`, com duas
réplicas, healthcheck `/api/health`, sem mudanças staged e sem variáveis
`VENDAS_SANDBOX_*`. Deployment `84e980d8-fb0e-4f06-bfd7-26dcd40519a7`,
commit `e409a3c`, está `SUCCESS`; o Railway informou `canRollback=true` e
`canRedeploy=true` nesta conferência. Revalidar essa disponibilidade antes da
entrega; não executar rollback nesta revisão.

Plano para uma entrega autorizada: separar documentos de outras tarefas,
preservar o deployment de retorno, publicar o candidato aprovado sem copiar
configurações do Copy e conferir healthcheck, login/consultas dos três perfis,
paginação/totais do ADM e abertura dos anexos. Produção continua somente leitura
nas verificações; eventual escrita exige autorização própria. Sem migração nesta
entrega, retorno ao código anterior não exige restauração de banco. Depois,
retomar L04 na branch de auditoria e no Copy, respeitando sua aprovação pendente.

Esta rodada não repetiu a baseline visual nem registrou nova venda no Copy.
As validações visuais de L01–L03 continuam datadas de 30/09/2026, sobre o mesmo
código. Testes simulados não comprovam uma implantação do candidato em produção.
Evidências adicionais e fixture privada de regressão ficam em `.cache/vendas-copy/`:
`final-review-production.test.ts`, `final-review.vitest.config.ts` e
`final-review-format-global.log`. Esses arquivos permanecem fora do Git.

## Publicação autorizada de L01–L03 — 06/10/2026

Após a revisão e o resumo da entrega, o usuário respondeu “perfeito, faça”.
Autorizou publicar os lotes L01–L03 em `main`, acompanhar o deploy e conferir
o funcionamento em produção em leitura, aceitando a falha preexistente de
formatação fora do diff para tratamento separado. L04 permanece proposto.

Antes da publicação: candidato de aplicação permanece o código revisado de
`0df2d5f`; somente os três documentos desta conversa recebem atualização.
Alterações de outras tarefas preservadas e excluídas. Produção reconfirmada
em `e409a3c`, deployment `84e980d8-fb0e-4f06-bfd7-26dcd40519a7`, com retorno
disponível (`canRollback=true`), duas réplicas e nenhum opt-in de sandbox.
Nesse primeiro registro, publicação e validações ainda estavam em andamento;
o resultado consolidado aparece abaixo.

**Resultado concluído:** `main` recebeu, por fast-forward, o commit
`019da5e8ca1cacee677e08d7d7b4173b1128df29`, preservando a branch de auditoria e
os documentos de outras tarefas. Deployment de produção
`1fbdf1dd-741c-414c-9e6b-3251c9428372` SUCCESS, versão 2.19.2 confirmada em Minha
Conta. Publicação em 06/10/2026, aproximadamente 21h17 no horário de Brasília.
Nenhuma variável, conexão, bucket, configuração Railway ou migração foi alterada.

**Correção da conclusão sobre formatação:** o CI completo deste commit passou
em [Verify](https://github.com/LukasClay/Vendas/actions/runs/37551000457):
typecheck, formatação global, 239 testes em 31 arquivos e build. A falha local
registrada na revisão tinha 175 arquivos com CRLF no Windows. Todos os 175
passam após normalização LF em memória, sem modificar os arquivos. A configuração
Prettier exige LF e o Git armazena LF; a divergência era do checkout local,
não um bloqueio de CI do candidato. Nenhum workflow ou gate foi desativado.
As afirmações anteriores de possível falha do CI devem ser lidas com esta
correção; não há lote de formatação global obrigatório para esta entrega.

Conferências posteriores de produção, estritamente em leitura:

- `/api/health`: HTTP 200, `status=ok`, com consulta real `SELECT 1` ao banco;
- Railway: 2/2 réplicas online, nenhuma falha ou alerta no checkpoint, nenhum
  staged change e nenhum `VENDAS_SANDBOX_*`; logs confirmam aquisição da liderança
  e início dos jobs pela líder;
- sessão ADM já autenticada preservada, versão 2.19.2 confirmada em Minha Conta;
- histórico: 50 linhas, página 1/57 e página 2/57; 2.816 registros e
  R$ 470.763,23 de total filtrado, coincidentes com o relatório independente;
- filtro Individual reinicia na página 1, 307 registros, R$ 160.878,25 e
  50 linhas individuais; detalhes e comprovante público carregados;
- tabela com 1440 px CSS efetivos: nenhuma rolagem da página, rolagem interna
  residual de 72 px, conforme resultado previamente documentado do L03;
- relatórios com 390 px CSS efetivos: labels Início/Fim, fonte 16 px, ambos os
  campos dentro da viewport e sem overflow da página. Respeitado o zoom existente
  do Chrome; override de viewport restaurado ao finalizar;
- formulário Nova Venda, catálogo de trabalhos e histórico pessoal carregados
  em 390 px, sem overflow ou alerta visível;
- painel consultora em 390 px: filas Para Escrever/Pendentes/Feitos, filtro
  Individual, detalhes e foto de um trabalho concluído carregados. Nenhuma ação
  de marcar/desfazer foi executada;
- nenhum erro de console capturado na aba de conferência. A amostra de logs
  HTTP retornada contém respostas 200/304, sem erro upstream; não equivale a
  garantia de ausência de erro em todas as requisições do serviço.

Limites: formulário, histórico pessoal e consultora foram conferidos pela sessão
ADM, cujo acesso é permitido nessas rotas. Não houve login separado de vendedora
ou consultora, nem envio de venda, upload ou mudança de status em produção.
Os testes completos de escrita e conteúdo das exportações permanecem os
documentados no Copy, sobre o mesmo código; não foram repetidos em produção.
Sem regressão observada nas conferências, sem prometer ausência absoluta de risco.

Retorno ao código anterior: deployment `84e980d8-fb0e-4f06-bfd7-26dcd40519a7`,
commit `e409a3c`, com `canRollback=true` e `canRedeploy=true` reconfirmados após
as verificações finais, mesmo com status REMOVED. Reconsultar
disponibilidade no Railway se necessário; nenhuma restauração de banco foi feita
ou é exigida por esta entrega sem alteração de schema.

Evidências privadas: `production-release-version-2.19.2.png` e
`production-release-reports-mobile.png` em `.cache/vendas-copy/`, fora do Git.
Este resultado documental é consolidado na branch de auditoria após a entrega,
sem provocar um segundo deploy de produção somente para atualizar o checkpoint.
L04 segue apenas proposto e depende de aprovação própria.

## Medida de progresso

Três lotes concluídos no Copy, em Vendas e Relatórios. Das 13 telas ADM do escopo,
2 receberam correções, aproximadamente 15% por essa contagem de telas. Isso não
mede a porcentagem total de implementação: uma tela pode ter outros achados e
os lotes têm esforços diferentes. Não há backlog completo com pesos que
permita afirmar um percentual global confiável. Infraestrutura do clone e
baseline representativa são etapas preparatórias, separadas dessa contagem.

Novos lotes em produção continuam dependendo de aprovação separada. A existência de uma branch
e do clone reduz o risco dos testes e não garante funcionamento perfeito em
produção, que mantém diferenças de jobs, réplicas, sessões e entrega de mídia.

## Limpeza, integridade e evidências

Venda fictícia `2743`, cliente novo `1007`, três objetos e um registro de auditoria
da venda foram removidos após os testes. Não foram alteradas vendas históricas.
A conferência posterior aprovou os hashes comerciais do snapshot, normalizando
somente as URLs privadas de mídia. Bucket novamente com 2.823 objetos /
626.543.119 bytes; chave de teste continua recebendo 403 no bucket de produção.
Configuração e deployment de produção permaneceram iguais à baseline.

Evidências privadas em `.cache/vendas-copy/`, ignoradas pelo Git:

- `visual-journal.private.json`: IDs, arquivos fictícios e confirmação da limpeza.
- `baseline-vendedora-formulario.jpg`: formulário antes do envio.
- `baseline-consultora-feito.jpg`: trabalho fictício concluído no celular.
- `baseline-adm-detalhes-desktop.jpg`: detalhes da venda fictícia.
- `baseline-adm-vendas-mobile.jpg`: histórico filtrado no celular.
- `baseline-adm-relatorios-mobile.jpg`: campo de data cortado.
- `final-isolation-verification.json`: integridade e isolamento posteriores.

Capturas são evidência da rodada, podem conter dados privados e não devem ser
publicadas no Git. Uma captura da confirmação da vendedora ficou reduzida pela
ferramenta; o resultado foi confirmado pela interface, histórico e banco.
