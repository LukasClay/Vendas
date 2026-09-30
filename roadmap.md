# Roadmap — UI/UX do painel ADM

> Checkpoint documental: 30/09/2026. Base principal:
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

| ID   | Etapa                                                         | Situação                        | Evidência e limite                                                                                                     |
| ---- | ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PREP | Branch, banco copiado, storage privado e proteções do sandbox | Concluída no checkpoint         | Ambiente independente verificado; não equivale a paridade completa com produção.                                       |
| BASE | Baseline dos fluxos essenciais e telas representativas        | Concluída                       | Registro/arquivos da vendedora, conclusão pela consultora e verificações ADM; não cobre todos os estados das 13 telas. |
| L01  | Histórico completo, totais, categoria e exportações           | Implementado e validado no Copy | Versão 2.19.0; acesso após os primeiros 200 registros e exportações completas conferidos.                              |
| L02  | Datas dos relatórios no celular                               | Implementado e validado no Copy | Versão 2.19.1; controles conferidos em 320, 390, 768 e 1440 px.                                                        |
| L03  | Legibilidade da tabela de Todas as Vendas no desktop          | Aprovado; em implementação      | Typecheck, build e 239 testes aprovados; validação visual no Copy pendente.                                            |
| CONS | Consolidar demais achados e cobertura das 13 telas            | Pendente de planejamento        | Os dois MDs de origem registram uma baseline representativa; não constituem o backlog completo da auditoria ampla.     |
| PROD | Entrega em produção                                           | Não autorizada                  | Exige avaliação específica do diff, das diferenças entre ambientes e aprovação do usuário.                             |

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

### L03 — aprovado para implementar e testar no Copy

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

Ajuste em implementação: largura disponível somente nesta página, padding
lateral de 16 px nas células, tabela com colunas estáveis e cliente/trabalho
usando o espaço restante, texto integral com quebra e ações fixas à direita.
Largura mínima de 1.200 px é uma hipótese de implementação a validar no Copy,
com rolagem interna nas larguras menores. Nenhuma navegação, paleta, query ou
componente compartilhado será reorganizado.

Versão local em preparação: 2.19.2. Validação publicada ainda pendente.

## Pendências recuperáveis dos documentos de origem

| Item                                          | Evidência disponível                             | Próxima decisão ou validação                                                                                                |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Rolagem/legibilidade de Todas as Vendas       | Medição da baseline e resultado de L01           | L03 aprovado, em execução.                                                                                                  |
| Atalhos de período com UTC nos relatórios     | Registrados como achado separado em L02          | Conferir comportamento e critério de fuso nas viradas de dia/semana antes de propor correção; L02 não corrigiu essa lógica. |
| Auditoria completa das demais superfícies ADM | Escopo amplo permanece pendente de consolidação  | Recuperar achados já existentes e suas evidências; investigar apenas o que estiver ausente ou contraditório.                |
| Validação em aparelhos físicos e rede móvel   | Limitação explícita da baseline                  | Planejar quando relevante ao lote, sem afirmar que emulação de viewport cobre esses cenários.                               |
| Performance dos anexos em produção            | Mídia privada do clone difere de URL pública/CDN | Avaliar essa diferença antes de uma entrega que afete anexos.                                                               |

## Cobertura documentada das 13 telas

Esta tabela registra o que é recuperável dos dois MDs de origem sobre a
validação no Copy. Não afirma que as outras telas nunca foram analisadas em uma
passagem anterior. Faltam resultados detalhados dessas telas nesses documentos.

| Tela ADM                    | Registro recuperável da validação no Copy                                                | Implementação desta sequência                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Dashboard                   | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Relatórios                  | Métricas, filtros, gráficos e responsividade representativos                             | L02 concluído; outras pendências continuam.                   |
| Todas as Vendas             | Lista, filtros, detalhes, paginação, exportações e responsividade                        | L01 concluído; L03 em execução.                               |
| Nova Venda no ADM           | Sem resultado detalhado específico do ADM                                                | Nenhum lote registrado; formulário pode afetar outros perfis. |
| Trabalhos                   | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Painel Trabalhos            | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Consultas administrativas   | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Alertas                     | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Cadastros                   | Busca, segunda página/retorno, ficha e histórico vinculado                               | Nenhum lote registrado.                                       |
| Funcionários                | Sem resultado detalhado nos MDs de origem                                                | Nenhum lote registrado.                                       |
| Lixeira                     | Sem validação visual detalhada; teste técnico de soft delete/restauração não a substitui | Nenhum lote registrado.                                       |
| Segurança                   | Sem resultado detalhado de UI nos MDs de origem                                          | Nenhum lote registrado.                                       |
| Minha Conta / Configurações | Atualização do número da versão; não é uma auditoria da tela                             | Nenhum lote de UI registrado.                                 |

Sidebar, componentes compartilhados, modais, formulários e estados de
loading/vazio/erro também pertencem ao escopo amplo. A cobertura deve registrar
as verificações concretas, sem concluir qualidade apenas porque uma tela abriu.

## Progresso e próximos lotes

- Duas entregas de UI/UX validadas, em duas das 13 telas: aproximadamente 15%
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
