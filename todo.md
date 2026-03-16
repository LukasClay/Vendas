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
