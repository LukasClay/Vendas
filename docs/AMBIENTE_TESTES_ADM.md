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

## Estado inicial da execução

- Branch local criada a partir do commit publicado, preservando o arquivo
  não rastreado `Qualidade de vida plugin gpt.md`.
- Proteções e testes preparados localmente.
- Versão da branch: `2.18.1`, incremento de patch para as proteções de teste.
- Validação local: typecheck e build aprovados; 216 testes de backend aprovados.
- Formatação dos arquivos alterados aprovada. A checagem global falha em 180
  arquivos preexistentes fora deste lote; não houve normalização geral.
- Login do Railway CLI solicitado ao usuário; exportação/restauração pendentes.
- Nenhuma configuração de produção alterada.
- Nenhum dado de produção exportado ou restaurado até este registro.
- Nenhuma melhoria de UI/UX implementada nesta preparação.

Este registro deve ser atualizado conforme a preparação e a validação avancem.
