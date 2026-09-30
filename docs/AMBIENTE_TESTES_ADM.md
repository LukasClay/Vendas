# Ambiente de testes da auditoria ADM

## Escopo autorizado

Preparar uma branch e o serviço Railway `Vendas Copy`, com cópia independente
dos dados de produção. A produção serve somente como origem de leitura da
exportação; alterações, restaurações e testes de escrita ficam no clone.
Publicar em `main` e alterar o serviço de produção continuam fora deste escopo.

## Identificações verificadas em 30/09/2026

- Repositório: `LukasClay/Vendas`.
- Branch de trabalho: `codex/adm-ui-ux`.
- Base confirmada no deployment de produção: `e409a3c4d5e197243aabba139c0bc8741413cc60`.
- Projeto Railway: `965a7f9d-1919-4535-8bff-31a7d336af1a`.
- Ambiente Railway atual: `ba87ff83-4b26-4aa8-8782-40277e3afabb`.
- Aplicação de produção `Vendas`: `cea7be01-820b-4c8a-af25-26a9dfb3bdfd`.
- PostgreSQL de produção: `0228bfd3-ae91-4cc8-bb43-74acecab1c8c`.
- Aplicação de teste `Vendas Copy`: `0e9149ea-257f-413a-b6b0-ec8e0bf9c6d5`.
- PostgreSQL de teste `Postgres Copy`: `1053b080-6531-4249-a037-1f87aac49e17`.
- Branch anterior do serviço de teste: `codex/sales-insights-mcp-phase-2`.
- Deployment anterior do teste: `d0974776-fc43-46b6-8793-face25a52c34`.

Os serviços de teste estão no mesmo ambiente Railway que a produção. A separação
precisa ser confirmada pelas conexões, pelos serviços e pelas credenciais; o nome
`Copy` não garante isolamento. Não registrar senhas, chaves, URLs com credenciais
ou dados pessoais neste documento nem no Git.

## Proteções da branch

- `VENDAS_SANDBOX_MODE=1`: impede a inicialização dos jobs e bloqueia envio de
  e-mail, Web Push e notificações ao proprietário, inclusive chamadas manuais.
- `VENDAS_SANDBOX_DATABASE_HOST`: obrigatório no modo de teste. A aplicação
  bloqueia a conexão antes de criar o pool se o host não for o esperado.
- `VENDAS_SANDBOX_STORAGE_BUCKET`: permite usar somente o bucket explicitamente
  configurado para teste; o proxy Manus fica desabilitado nesse modo.
- A configuração efetiva do banco dá preferência a `RAILWAY_DATABASE_URL`
  sobre `DATABASE_URL`; conferir as duas antes de qualquer inicialização.
- O modo de teste precisa ser ativado somente no serviço `Vendas Copy`.
  Sem opt-in, o comportamento de produção permanece como na base.

## Ordem de preparação

1. Confirmar IDs, conexão efetiva, versão PostgreSQL e recursos de origem/destino.
2. Preservar o banco de teste existente antes de qualquer substituição. Preferir
   restaurar a cópia em um banco novo dentro do serviço de teste, permitindo
   voltar ao banco anterior sem apagá-lo.
3. Preparar credenciais próprias, bucket de teste e bloqueios antes do boot.
4. Exportar produção em snapshot consistente, sem alterações na origem;
   armazenar o dump fora do Git e restaurar somente no destino verificado.
5. Conferir tabelas, registros, sequências e relações; isolar no clone
   destinatários, subscriptions e sessões que não devem ser usados em testes.
6. Copiar os anexos necessários para storage separado e ajustar referências
   somente no clone. Um dump PostgreSQL não copia arquivos S3/R2.
7. Conectar o serviço `Vendas Copy` à branch de teste e validar healthcheck,
   ausência de envios/jobs e comportamento inicial dos três perfis.
8. Registrar testes e limitações antes de iniciar os lotes de UI/UX.

## Estado verificado da execução em 30/09/2026

- Branch local criada a partir do commit publicado, preservando o arquivo
  não rastreado `Qualidade de vida plugin gpt.md`.
- Branch publicada no GitHub e conectada somente ao serviço `Vendas Copy`.
- Proteções publicadas no commit `b3d4786aa98bbec015d16ee9966ece744af32985`.
- Deployment de teste confirmado como `SUCCESS`:
  `0fce4c00-18a9-4fd9-beda-1dc2fe58bca8`. O deployment anterior foi encerrado.
- Versão da branch: `2.18.1`, incremento de patch para as proteções de teste.
- Validação local: typecheck e build aprovados; 216 testes de backend aprovados.
- Formatação dos arquivos alterados aprovada. A checagem global falha em 180
  arquivos preexistentes fora deste lote; não houve normalização geral.
- Railway CLI autenticado pelo usuário.
- Os dois bancos usam PostgreSQL 18.6. Exportação em snapshot consistente, com
  transação somente leitura e transferência criptografada.
- Cópia restaurada em `vendas_auditoria_20260930`, dentro do `Postgres Copy`, com
  usuário de banco próprio, sem privilégios de superusuário. O banco anterior
  `railway` foi preservado.
- As 10 tabelas tiveram contagens e checksums de todos os registros iguais ao
  snapshot antes dos ajustes de segurança. Conferidas 10 sequências e nenhuma
  constraint não validada.
- Snapshot: 2.732 vendas, 1.004 clientes, 126 produtos, 90 horários, 12 usuários,
  3.259 logs, 22 sessões, 1 assinatura push, 2 agendamentos e 1 configuração.
  Essas contagens incluem registros excluídos logicamente, quando existentes.
- Somente no clone: senhas dos 12 usuários rotacionadas; três contas
  representativas receberam acessos de teste para ADM, consultora e vendedora.
  Foram removidas 22 sessões e 1 assinatura push, e desativados os 2
  agendamentos, com destinatários substituídos por endereços `.invalid`.
- Somente no serviço de teste: JWT, cookie, senha mestre, VAPID e identificação
  da aplicação separados; MCP antigo e Resend desabilitados. Ambas as variáveis
  de banco apontam ao host privado `postgres-copy.railway.internal`, usando o
  banco novo.
- Healthcheck aprovado. Passaram 22 verificações de API: login/logout dos três
  perfis, consultas ADM/consultora/vendedora e limites de permissão.
- Logs do deployment confirmam jobs e envios desabilitados. Dados de vendas,
  clientes, produtos e horários mantêm o checksum do snapshot após o boot.
- Configuração e deployment de produção conferidos sem alteração: produção
  continua em `main`, no deployment `84e980d8-fb0e-4f06-bfd7-26dcd40519a7`.
- Nenhuma melhoria de UI/UX implementada nesta preparação.

## Storage privado do clone, preparação em andamento

A inspeção encontrou o mesmo bucket, a mesma chave S3 e o mesmo JWT nos serviços
de produção e teste anteriores. O banco era separado, mas o storage não.

O bucket `vendas-magia-auditoria-adm` foi criado com acesso público desabilitado.
O usuário aprovou o token `Vendas Copy Auditoria ADM`, com Object Read & Write
restrito a esse bucket e validade até 30/10/2026. A chave foi configurada somente
no serviço de teste, sem iniciar deployment intermediário. Uma tentativa de
acessar o bucket de produção com essa chave retornou HTTP 403.

Inventário congelado da origem: 2.823 objetos, 626.543.119 bytes (aproximadamente
598 MiB). A transferência usa somente leitura na origem, cria objetos novos no
destino e verifica tamanho, checksum e inventário. Dois downloads excederam o
tempo limite na primeira passagem e estão sendo retomados separadamente.

O usuário escolheu anexos privados, acessíveis após login. A rota
`/api/sandbox/media/*` só é registrada quando `VENDAS_SANDBOX_MODE=1`; ADM pode
ler os arquivos referenciados, vendedora somente os arquivos das próprias vendas
ativas, e consultora somente fotos de vendas ativas. Os arquivos são servidos
sem cache público, com tipo de conteúdo limitado e sem revelar chaves S3.

Há 2.779 referências de mídia nas vendas e todas têm chave no inventário. O
ajuste de URLs é restrito ao banco novo do clone, com backup prévio e comparação
dos demais campos. Não altera os timestamps nem os dados comerciais das vendas.
O incremento de patch preparado para esta etapa é `2.18.2`.

Validação local da rota privada: typecheck, build e 226 testes de backend
aprovados, incluindo permissões HTTP e desativação da rota fora do sandbox.
A publicação desse código e os testes de upload/download/exclusão no deploy
ainda estão pendentes neste checkpoint.

O clone é um snapshot, com jobs e envios bloqueados. A entrega de mídia pelo
servidor privado difere da URL pública/CDN de produção e não permite afirmar
paridade exata de performance de anexos. Os testes de API não comprovam layout,
responsividade nem uma regressão visual completa.

Na retomada, a abertura do Vendas Copy no navegador foi bloqueada pela revisão
automática da ferramenta. A primeira falha informou limite de uso; a tentativa
de retomada foi rejeitada por repetir a abertura antes de resolver esse bloqueio.
Nenhuma ação foi executada no navegador do clone. Não contornar por outra aba,
browser, automação alternativa ou comandos de navegador. Resolver o bloqueio
da ferramenta antes de continuar a validação visual. A autorização do usuário
para preparar o clone permanece válida; esta é uma limitação da ferramenta.

## Continuidade e retorno

- Evidências, dump, conexões e acessos de teste estão em `.cache/vendas-copy/`,
  ignorado pelo Git. Contêm informação privada e não devem ser publicados.
- `ACESSO_TESTE_PRIVADO.md` contém os acessos exclusivos do clone.
- `source-manifest.json` e `restore-verification.json` registram a integridade
  antes dos ajustes; `final-verification.json` e `smoke-api-result.json`
  registram as verificações após o deployment.
- A conexão e configuração anteriores do teste foram preservadas localmente
  em `variables.private.json`. Não restaurar esse arquivo integralmente: a
  configuração antiga reutilizava credenciais de produção.
- Se for necessário retornar ao banco antigo do teste, manter código com as
  proteções de sandbox, os envios bloqueados e as credenciais de storage de
  produção ausentes. O banco antigo não foi apagado.
- Concluir a cópia, ajustar os links, publicar e verificar a rota privada. Depois,
  resolver o bloqueio do navegador e registrar a baseline visual antes dos lotes
  de UI/UX. O token expira em 30/10/2026 e precisará de renovação autorizada se
  o ambiente de teste continuar em uso após essa data.
