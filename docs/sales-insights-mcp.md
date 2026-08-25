# Sales Insights e integração MCP

## Status

A fase 1 implementa somente a fundação interna do `Sales Insights`. Ela não
publica uma rota MCP, não altera o login atual, não cria tabelas e não executa
operações no banco durante testes.

Arquivos da fase:

- `server/salesInsights/calendar.ts`: calendário de vendas no fuso oficial;
- `server/salesInsights/repository.ts`: consultas exclusivamente agregadas;
- `server/salesInsights/service.ts`: contratos, autorização e métricas;
- `server/salesInsights/*.test.ts`: regras de negócio, formato das queries e
  isolamento entre vendedores.

## Arquitetura alvo

```text
ChatGPT
  -> MCP remoto por HTTPS (Streamable HTTP)
  -> OAuth 2.1 e scopes
  -> adaptador /mcp no Express existente
  -> Sales Insights
  -> Drizzle
  -> PostgreSQL
```

O adaptador MCP deverá ser fino: validar o protocolo e transformar erros, sem
duplicar consultas ou regras de negócio. O painel atual poderá reutilizar o
mesmo serviço posteriormente, sem mudar sua autenticação nesta fase.

Referências oficiais usadas para o desenho:

- [Autenticação de plugins](https://developers.openai.com/plugins/build/auth)
- [Contratos de ferramentas](https://developers.openai.com/plugins/plan/tools)
- [Servidor MCP remoto](https://developers.openai.com/plugins/concepts/mcp-server)

## Contratos iniciais

### `get_sales_snapshot`

Entrada:

- `sellerId` opcional, sujeito à autorização;
- até dez `targets` positivos para simulações da conversa.

Saída:

- total do dia e do mês;
- meta oficial configurada e simulações não persistidas;
- saldo, necessidade por dia útil primário e situação adiantada/atrasada;
- projeção baseada somente em períodos concluídos;
- estado explícito do dia atual e limitações do cálculo.

### `get_sales_performance`

Entrada:

- `sellerId` opcional, sujeito à autorização;
- intervalo de datas de até 366 dias.

Saída:

- série diária preenchida, inclusive dias sem vendas;
- total e quantidade de vendas;
- média, melhor e pior dia somente entre períodos concluídos;
- classificação de cada dia, sem dados de clientes.

Os nomes acima são os nomes planejados das ferramentas MCP. Nesta fase, os
contratos existem como métodos internos `getSalesSnapshot` e
`getSalesPerformance`.

## Regras de calendário

- fuso oficial: `America/Sao_Paulo`;
- segunda a sexta: dias primários completos;
- sábado: período suplementar de meia jornada, encerrado às 12:00;
- domingo: fechado;
- vendas de sábado contam no faturamento, na meta e no histórico;
- sábados futuros não entram no divisor da meta necessária por dia útil;
- o dia atual de segunda a sexta permanece incompleto enquanto o horário de
  encerramento não estiver configurado;
- médias históricas excluem o período atual incompleto;
- feriados não são excluídos nesta fase, pois a regra definida foi de segunda a
  sexta sem um calendário de feriados específico para metas.

A projeção usa unidades de capacidade: `1` para segunda a sexta e `0,5` para
sábado. Ela mantém as vendas já realizadas no total, mas não extrapola o resto
do dia atual sem horários confiáveis.

## Autorização e dados

| Ação                                       | Requisito                              |
| ------------------------------------------ | -------------------------------------- |
| Consultar os próprios agregados            | scope `sales:read:self`                |
| Consultar outro vendedor                   | role `admin` e scope `sales:read:team` |
| Consultar a si próprio com scope de equipe | role `admin` e `sales:read:team`       |

A autorização é verificada antes da consulta ao repositório. Assim, um token
sem acesso não consegue usar a existência de IDs de vendedores como canal de
enumeração.

As queries selecionam somente perfil mínimo do vendedor, data, soma e contagem.
Elas sempre filtram `sellerId` e `deletedAt IS NULL`. Não retornam nome, telefone
ou nascimento de clientes, observações, comprovantes, fotos, chaves de storage,
tokens ou senhas.

## Próximas fases

1. definir o provedor OAuth 2.1, emissão/revogação de scopes e vínculo entre o
   subject do token e `users.id`;
2. adicionar o adaptador MCP ao Express com HTTPS, Streamable HTTP, limites de
   requisição, logs sem conteúdo sensível e tradução de erros;
3. publicar `get_sales_snapshot` e `get_sales_performance` como ferramentas
   somente leitura;
4. validar o fluxo ponta a ponta em ambiente não produtivo;
5. somente depois, avaliar ferramentas administrativas de equipe e ranking.

Antes de métricas por hora, ainda é necessário definir início, intervalo e fim
do expediente de segunda a sexta. Essa pendência não recebe valores presumidos.

## Fluxo seguro de entrega com `vendas-copy`

### Gate 1 — branch e validação local

1. trabalhar somente em uma branch `codex/*`, nunca diretamente na `main`;
2. revisar `git diff origin/main...HEAD` e confirmar que os painéis críticos e
   a autenticação atual não foram alterados sem necessidade;
3. executar typecheck, testes backend, Prettier somente nos arquivos da entrega
   e build de produção;
4. manter commit e push como aprovações separadas.

### Gate 2 — ambiente `vendas-copy`

Antes de conectar ferramentas MCP, confirmar no Railway que o serviço de testes:

- acompanha exclusivamente a branch de teste;
- usa banco de dados separado do `vendas` de produção;
- usa domínio e cookies próprios;
- não envia push, relatórios ou e-mails para destinatários reais;
- usa credenciais OAuth e storage próprios ou explicitamente desabilitados;
- permite desligar a integração com `MCP_ENABLED=false`.

Após o deploy, verificar `GET /api/health` e executar manualmente:

- login de vendedor, consultora e admin;
- criação de uma venda fictícia;
- histórico do vendedor sem vendas de terceiros;
- painel da consultora e seus fluxos principais;
- logout, novo login e invalidação de sessão;
- dashboard e relatórios do ADM;
- ausência de `/mcp` enquanto a fase 2 não estiver habilitada.

O deploy desta fase 1 valida regressões do sistema existente. Ele ainda não
valida uma conversa com o ChatGPT, porque o adaptador MCP e o OAuth permanecem
desconectados.

### Gate 3 — produção

Somente depois do aceite no `vendas-copy`:

1. revisar novamente o diff contra `origin/main` atualizado;
2. obter aprovação específica para merge/push em `main`;
3. acompanhar health check e logs do primeiro deploy do `vendas`;
4. repetir os smoke tests críticos;
5. em caso de falha, desligar `MCP_ENABLED` ou reverter somente o commit da fase
   responsável, sem migration destrutiva.
