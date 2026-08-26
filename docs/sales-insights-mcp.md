# Sales Insights e integração MCP

## Status

A fase 2 implementa o resource server MCP na branch de teste. A integração
permanece desligada por padrão e ainda não foi conectada ao ChatGPT. O login
local atual não foi substituído nem reutilizado como bearer token do MCP. Não há
tabelas ou migrations novas.

Arquivos principais:

- `server/salesInsights/calendar.ts`: calendário de vendas no fuso oficial;
- `server/salesInsights/repository.ts`: consultas exclusivamente agregadas;
- `server/salesInsights/service.ts`: contratos, autorização e métricas;
- `server/salesInsights/*.test.ts`: regras de negócio, formato das queries e
  isolamento entre vendedores;
- `server/mcp/config.ts`: configuração fail-closed;
- `server/mcp/tokenVerifier.ts`: validação JWT e vínculo com usuário ativo;
- `server/mcp/routes.ts`: metadados OAuth, rate limit e Streamable HTTP;
- `server/mcp/server.ts`: ferramentas read-only;
- `server/mcp/*.test.ts`: autenticação, transporte, schemas e isolamento.

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

O adaptador MCP é fino: valida protocolo, token e schemas e delega as regras ao
Sales Insights. O painel e o login atuais não dependem do MCP.

Referências oficiais usadas para o desenho:

- [Autenticação de plugins](https://developers.openai.com/plugins/build/auth)
- [Contratos de ferramentas](https://developers.openai.com/plugins/plan/tools)
- [Servidor MCP remoto](https://developers.openai.com/plugins/concepts/mcp-server)

## Contratos iniciais

### `get_sales_snapshot`

Entrada:

- até dez `targets` positivos para simulações da conversa.

Saída:

- total do dia e do mês;
- meta oficial configurada e simulações não persistidas;
- saldo, necessidade por dia útil primário e situação adiantada/atrasada;
- projeção baseada somente em períodos concluídos;
- estado explícito do dia atual e limitações do cálculo.

### `get_sales_performance`

Entrada:

- intervalo de datas de até 366 dias.

Saída:

- série diária preenchida, inclusive dias sem vendas;
- total e quantidade de vendas;
- média, melhor e pior dia somente entre períodos concluídos;
- classificação de cada dia, sem dados de clientes.

As duas ferramentas são publicadas somente quando `MCP_ENABLED=true`. A
superfície MCP inicial não aceita `sellerId`: ela sempre usa o usuário vinculado
ao token. O suporte interno a `sales:read:team` permanece reservado para uma
ferramenta administrativa futura.

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

| Superfície                      | Requisito                              |
| ------------------------------- | -------------------------------------- |
| MCP fase 2: próprios agregados  | scope `sales:read:self`                |
| Serviço interno: outro vendedor | role `admin` e scope `sales:read:team` |
| Ferramenta MCP administrativa   | ainda não publicada                    |

A autorização é verificada antes da consulta ao repositório. Assim, um token
sem acesso não consegue usar a existência de IDs de vendedores como canal de
enumeração.

As queries selecionam somente perfil mínimo do vendedor, data, soma e contagem.
Elas sempre filtram `sellerId` e `deletedAt IS NULL`. Não retornam nome, telefone
ou nascimento de clientes, observações, comprovantes, fotos, chaves de storage,
tokens ou senhas.

O token deve conter uma claim configurável com o `users.id` numérico. E-mail não
é usado como vínculo porque não é obrigatório nem único no modelo atual. Após
validar a assinatura, o servidor busca apenas `id` e `role`, exigindo
`active=true` e `deletedAt IS NULL`. O cargo do token nunca é aceito como fonte
de autorização.

## Configuração da fase 2

Nenhuma das variáveis abaixo deve ser criada em produção durante o teste. Elas
serão configuradas primeiro somente no serviço Vendas Copy:

| Variável                    | Finalidade                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| `MCP_ENABLED`               | `false` por padrão; `true` publica metadados e `/mcp`             |
| `MCP_RESOURCE_URL`          | URL HTTPS canônica e exata do endpoint `/mcp`                     |
| `MCP_AUTH_ISSUER`           | issuer exato publicado pelo provedor OAuth                        |
| `MCP_AUTH_JWKS_URL`         | JWKS usado para verificar assinaturas RS256                       |
| `MCP_AUTH_USER_ID_CLAIM`    | nome da claim que contém o `users.id` autorizado                  |
| `MCP_RATE_LIMIT_PER_MINUTE` | limite por IP, opcional; padrão `60`, intervalo permitido `1-600` |

Quando habilitada, uma configuração incompleta encerra a inicialização em vez
de publicar um endpoint parcialmente protegido. Fora dos testes locais, todas
as URLs precisam usar HTTPS e `MCP_RESOURCE_URL` precisa terminar exatamente em
`/mcp`.

O provedor OAuth deve emitir tokens curtos para a audiência exata de
`MCP_RESOURCE_URL`, publicar discovery compatível com OAuth 2.1/PKCE S256 e
incluir o scope `sales:read:self`. O Vendas valida assinatura, issuer, audiência,
expiração, scope e usuário ativo em cada requisição.

O vínculo de teste deve ser mantido em metadados administrativos do provedor,
nunca em metadados que o próprio usuário possa editar. O logout do painel Vendas
encerra a sessão local, mas não revoga automaticamente um access token emitido
pelo provedor OAuth. Por isso, o teste deve usar tokens de curta duração e também
validar a revogação/desconexão pelo provedor e pelo ChatGPT.

## Proteções do endpoint

- corpo JSON limitado a 256 KB antes de chegar ao MCP;
- rate limit por IP antes da autenticação;
- transporte stateless, sem sessão compartilhada entre usuários;
- schemas estritos de entrada e saída;
- anotações `readOnlyHint=true`, `destructiveHint=false` e
  `openWorldHint=false`;
- erros e logs não incluem token, claims completas, parâmetros ou resultados;
- `/mcp` e metadados retornam 404 quando `MCP_ENABLED=false`.

## Pendências antes de `main`

1. criar/configurar um tenant OAuth de desenvolvimento separado;
2. vincular apenas a conta de teste ao `users.id` correspondente no banco Copy;
3. configurar as variáveis exclusivamente no Vendas Copy;
4. habilitar o MCP no Copy e verificar health check, metadados e recusas;
5. conectar a URL do Copy ao modo de desenvolvedor do ChatGPT;
6. comparar respostas do ChatGPT com o painel Copy;
7. repetir os smoke tests críticos do sistema existente;
8. validar desconexão/revogação e expiração do token de teste;
9. somente depois discutir merge/push em `main` e produção.

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
- `/mcp` e metadados respondendo 404 enquanto `MCP_ENABLED=false`.

Após habilitar a fase 2 somente no Copy, validar também:

- metadados OAuth retornando o resource e issuer esperados;
- `/mcp` sem token, token inválido e token sem scope recusados;
- ChatGPT solicitando autorização e listando somente as duas ferramentas;
- tentativa de informar `sellerId` recusada;
- totais retornados iguais aos dados do painel Copy;
- nenhum dado pessoal de cliente presente na resposta.
- token expirado/revogado recusado após a desconexão no provedor ou no ChatGPT.

### Gate 3 — produção

Somente depois do aceite no `vendas-copy`:

1. revisar novamente o diff contra `origin/main` atualizado;
2. obter aprovação específica para merge/push em `main`;
3. acompanhar health check e logs do primeiro deploy do `vendas`;
4. repetir os smoke tests críticos;
5. em caso de falha, desligar `MCP_ENABLED` ou reverter somente o commit da fase
   responsável, sem migration destrutiva.
