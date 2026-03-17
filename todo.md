# Sistema de Gestão de Vendas Espirituais - TODO

## Banco de Dados
- [x] Schema: tabela users (com role vendedor/admin)
- [x] Schema: tabela products (trabalhos espirituais)
- [x] Schema: tabela sales (vendas com todos os campos)
- [x] Schema: tabela clients (clientes)
- [x] Schema: tabela report_schedules (agendamentos de email)
- [x] Executar migration SQL

## Backend (tRPC Routers)
- [x] Router: auth (me, logout)
- [x] Router: users (listar, criar, editar, remover - admin)
- [x] Router: products (listar, criar, editar, remover - admin)
- [x] Router: sales (criar, listar, filtrar, detalhar)
- [x] Router: reports (totais, ranking vendedores, ranking clientes, por período)
- [x] Upload de comprovante para S3
- [x] Exportação Excel (xlsx)
- [x] Exportação PDF (jspdf + autotable)
- [x] Envio automático de relatórios por email (diário, semanal, mensal)

## Frontend - Layout e Design
- [x] Design system: cores douradas, tipografia Playfair Display, tema elegante
- [x] DashboardLayout com sidebar adaptada por role
- [x] Página de login/autenticação
- [x] Roteamento por role (vendedor vs admin) com AuthGuard

## Frontend - Vendedor
- [x] Formulário de nova venda
- [x] Upload de comprovante (PDF/imagem, máx 5MB, drag-and-drop)
- [x] Confirmação visual de venda registrada
- [x] Histórico de vendas do vendedor logado

## Frontend - Administrador
- [x] Dashboard com métricas principais (cards de totais)
- [x] Gráfico de vendas por mês (Recharts)
- [x] Tabela de todas as vendas com filtros (data, vendedor, produto)
- [x] Gestão de produtos (adicionar, editar, remover, ativar/desativar)
- [x] Gestão de usuários/vendedores (editar, promover, desativar)
- [x] Ranking de melhores clientes
- [x] Ranking de melhores vendedores
- [x] Exportar relatório em Excel
- [x] Exportar relatório em PDF
- [x] Configuração de relatórios automáticos por email (diário, semanal, mensal)
- [x] Página de configurações

## Testes
- [x] Testes unitários dos routers principais (13 testes passando)
- [x] Verificação de controle de acesso por role

## Deploy
- [ ] Instruções para Railway (a fazer após publicação)

## Bugs
- [x] Corrigir erro na query getSalesByMonth (MONTH/YEAR com alias no TiDB)

## Login Próprio (email/senha)
- [x] Adicionar campo passwordHash na tabela users
- [x] Backend: endpoint de login com email/senha + JWT
- [x] Backend: endpoint de criação de usuário pelo admin (com senha)
- [x] Frontend: tela de login com email/senha e "Lembrar de mim"
- [x] Frontend: painel de vendedores com criação e edição de senha
- [x] Remover botão "Promover a Admin" da interface

## Melhorias de Validação
- [x] Tornar data de nascimento e telefone obrigatórios no formulário de nova venda

## Responsividade Mobile
- [x] DashboardLayout: sidebar como menu hamburguer no mobile
- [x] Formulário de nova venda: otimizado para celular (inputs grandes, teclado numérico, UX simples)
- [x] Painel admin: dashboard, vendas, produtos e vendedores responsivos no mobile

## Perfil Consultora
- [x] Role "consultora" no schema e migration
- [x] Backend: endpoint de trabalhos pendentes por prioridade (7 dias úteis) para consultora
- [x] Backend: endpoint de histórico de compras por nome do cliente
- [x] Tela da Consultora: lista de trabalhos por prioridade, busca por nome do trabalho
- [x] Tela da Consultora: botões de copiar dados (nome, data nascimento, telefone, observação)
- [x] Tela da Consultora: sem acesso ao valor da venda
- [x] Tela da Consultora: histórico de compras do cliente (quantas vezes comprou)
- [x] Tela da Consultora: marcar trabalho como concluído
- [x] Painel admin: separar cadastro de Vendedor e Consultora
- [x] Rotas protegidas por role (consultora só acessa tela dela)
- [x] Otimização de performance mobile (celulares antigos)

## Reestruturação Painel Consultora
- [x] Schema: campo workStatus (para_escrever, pendente, feito) na tabela sales
- [x] Backend: cálculo de prazo 7 dias úteis (seg-sex) a partir do dia seguinte à venda
- [x] Backend: endpoints de transição de status (escrever→pendente, pendente→feito, feito→pendente)
- [x] Consultora: acesso ao formulário de vendas (igual vendedor)
- [x] Consultora: 3 abas com badges de contagem (Para Escrever, Pendentes, Feitos)
- [x] Consultora: aba Feitos mostra mais recentes no topo para fácil reversão
- [x] Consultora: botão "Copiar Tudo" na aba Para Escrever
- [x] Consultora: confirmação antes de marcar como feito
- [x] Corrigir redirecionamento inicial da consultora para tela correta
- [x] Corrigir label "Vendedor" para "Consultora" no painel da consultora (DashboardLayout)

## Melhorias Painel Admin
- [x] Renomear "Vendedores" para "Funcionários" em todo o sistema (menu, páginas, labels, rotas)
- [x] Adicionar seção de dias restantes/urgência das vendas no painel admin (similar ao painel da consultora)
- [x] Otimizar painel admin para desktop: layout mais amplo, tabelas completas, colunas lado a lado

## Segurança e Controle de Acesso
- [x] Frontend: guard de rota /admin bloqueia vendedor e consultora com redirecionamento imediato
- [x] Backend: adminProcedure revisada em todos os routers (products, users, reports, sales admin)
- [x] Painel Funcionários: botão "Novo Admin" para criar outros administradores

## Gestão de Vendas (Admin)
- [x] Painel admin: botão "Editar" venda (alterar qualquer campo)
- [x] Painel admin: botão "Excluir" venda (com confirmação)

## Bugs
- [ ] Corrigir erro "Failed query" ao fazer login com email/senha

## Bugs
- [x] Erro de login ao acordar da hibernação: implementar retry automático de conexão com o banco

## Melhorias Formulário e Sistema
- [ ] Adicionar campo Observação no formulário de vendas (vendedor/consultora)
- [x] Renomear sistema para "Mundo Da Magia LTDA" (login, cabeçalho, título)
  - [x] Gestão completa de funcionários pelo ADM: editar nome, email, senha e tipo de qualquer usuário

## Login por Nome de Usuário
- [x] Adicionar campo username único no schema (migration)
- [x] Backend: login por username + senha (sem email)
- [x] Backend: criar funcionário com username + senha + tipo
- [x] Frontend: tela de login com campo "Usuário" em vez de email
- [x] Frontend: unificar cadastro em "Novo Funcionário" com seleção de tipo
- [x] Frontend: gestão completa (editar nome, username, senha, tipo) pelo ADM
- [x] Renomear sistema para "Mundo Da Magia LTDA"
