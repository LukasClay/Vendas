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

Produção continua dependendo de aprovação separada. A existência de uma branch
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
