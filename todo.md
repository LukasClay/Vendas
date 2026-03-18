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
- [x] Corrigir erro "Failed query" ao fazer login com email/senha

## Bugs
- [x] Erro de login ao acordar da hibernação: implementar retry automático de conexão com o banco

## Melhorias Formulário e Sistema
- [x] Adicionar campo Observação no formulário de vendas (vendedor/consultora)
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

## Responsividade Mobile do Painel Admin (uso emergencial)
- [x] Verificar e corrigir edição de vendas (modal) no celular
- [x] Verificar e corrigir tabela de vendas no celular (scroll horizontal ou layout adaptado)
- [x] Verificar e corrigir gestão de funcionários no celular (edição inline, reset senha)
- [x] Verificar e corrigir gestão de produtos no celular
- [x] Verificar e corrigir dashboard (filtros, gráficos, cards) no celular
- [x] Verificar e corrigir exportação (Excel/PDF) no celular

## Funcionalidade Consulta Cartas
- [x] Schema: tabela consultation_slots (data, hora, vendida, sale_id)
- [x] Backend: seed automático do trabalho "Consulta Cartas" no banco
- [x] Backend: procedures tRPC para consulta_slots (listar disponíveis, criar, deletar)
- [x] Backend: procedure de venda com consultation_slot_id quando trabalho = Consulta Cartas
- [x] Formulário Nova Venda: campo horário de consulta condicional ao selecionar Consulta Cartas
- [x] Formulário Nova Venda (Consultora): igual ao vendedor + botão adicionar nova data/horário
- [x] Aba "Consultas" no painel da Consultora: Pendentes e Realizadas
- [x] Consultora: adicionar datas/horários de consulta diretamente no painel
- [x] Aba "Consultas" no painel do ADM (dentro de Trabalhos): visão geral + gerenciar datas
- [x] ADM: adicionar/remover datas e horários de consulta

## Melhorias Consulta Cartas - Dados da Venda
- [x] Backend: retornar dados da venda (vendedor, cliente, nascimento, telefone) junto com slot vendido
- [x] Frontend ADM: cards de consulta mostram dados da cliente/vendedor (corrigido)
- [x] Frontend Consultora: cards de consulta mostram dados da cliente/vendedor (corrigido)
- [x] Remover "Consulta Cartas" da aba de Trabalhos do ADM (implementado em seção posterior)
- [x] Remover "Consulta Cartas" do painel de trabalhos da Consultora (implementado em seção posterior)
- [x] Adicionar seção de Consultas no histórico de compras de uma cliente (implementado em seção posterior)

## Sistema de Status de Consultas (Híbrido)
- [x] Schema: adicionar campo status (pendente/realizada/cancelada) na tabela consultation_slots
- [x] Backend: lógica automática +50min para realizada nas queries listPending/listDone
- [x] Backend: procedure cancelar (consultora e ADM)
- [x] Backend: procedure restaurar (somente ADM)
- [x] Backend: procedure listCancelled (consultora e ADM)
- [x] Frontend Consultora: botão Cancelar nos cards pendentes
- [x] Frontend Consultora: aba "Cartas Canceladas" (somente visualização)
- [x] Frontend ADM: aba "Cartas Canceladas" com botão Restaurar
- [x] Testes: 25 testes passando (12 novos para consultationSlots)

## Liberar Horário Cancelado
- [x] Backend: procedure deleteCancelled (somente ADM) — apaga slot cancelado do banco
- [x] Frontend ADM: botão "Liberar Horário" na aba Canceladas (ao lado de Restaurar)
- [x] Testes: 28 testes passando (3 novos para deleteCancelled)

## Nova Venda para ADM
- [x] Menu lateral ADM: adicionar item "Nova Venda"
- [x] Rota /admin/nova-venda protegida (adminOnly) usando o mesmo formulário NovaVenda

## Itens Pendentes (solicitados pelo usuário)
- [x] Remover "Consulta Cartas" da aba de Trabalhos do ADM
- [x] Remover "Consulta Cartas" do painel de trabalhos da Consultora (já estava filtrado no backend)
- [x] Adicionar seção de Consultas no histórico de compras de uma cliente (ADM e Consultora)
- [x] Verificar bug dados cliente/vendedor nos cards de consulta (backend já retorna corretamente)
- [x] Procedure clientHistory para ADM (sales.clientHistory)
- [x] Modal de histórico de cliente na tela Todas as Vendas do ADM (botão no nome da cliente)

## Bug: Data errada nas vendas
- [x] Corrigir data de venda exibida com 2 dias a menos (ex: venda feita em 17/03 aparece como 15/03) — criado dateUtils.ts com formatDate sem timezone offset, aplicado em todos os arquivos

## Limpeza e Novas Funcionalidades (17/03/2026)
- [x] Limpar vendas de teste do banco (sales + consultation_slots)
- [x] Migration: adicionar campo cancelReason (texto opcional) na tabela consultation_slots
- [x] Backend: incluir cancelReason no procedure cancel
- [x] Frontend ADM: campo de motivo no modal de confirmação de cancelamento
- [x] Frontend Consultora: campo de motivo no modal de confirmação de cancelamento
- [x] Frontend: exibir motivo do cancelamento no card cancelado
- [x] Backend: notificação ao ADM (dono do projeto) quando consulta for cancelada (plataforma não suporta notif. para usuários individuais)
- [x] Corrigir bug de data salva com 1 dia a menos no banco (saleDate gravada como D-1)

## Bug: Perda de foco nos inputs de edição de funcionários
- [x] Corrigir campos de input que perdem foco a cada caractere digitado na tela de Funcionários (UserCard movido para fora do componente principal)

## Integridade de Dados e Novas Funcionalidades
- [x] Soft delete de funcionários: ao excluir, salvar snapshot (nome, username, role) nas vendas antes de marcar como deletado — dados de vendas preservados
- [x] Soft delete de trabalhos (products): ao excluir, salvar snapshot do nome no campo productName das vendas — dados preservados
- [x] Painel de Trabalhos para o ADM: abas "Para Escrever", "Pendentes" e "Realizados" com mesmas funcionalidades da Consultora
- [x] ADM pode alterar status de trabalhos (para_escrever → pendente → feito) e visualizar todos os trabalhos
- [x] Backend: incluir sellerName nas procedures toWrite/pending/done da Consultora
- [x] Frontend Consultora: exibir nome do vendedor nos cards de trabalho (Para Escrever, Pendentes, Feitos)
- [x] Frontend ADM: painel Trabalhos com rota /admin/trabalhos e item no menu

## Filtro por Tipo de Trabalho e Melhorias nos Cards
- [x] Consultora: filtro por tipo de trabalho (chips dinâmicos) nas 3 abas — só mostra tipos que existem naquela aba
- [x] Consultora: exibir nome do vendedor nos cards das 3 abas (Para Escrever, Pendentes, Feitos)
- [x] ADM Trabalhos: filtro por tipo de trabalho (chips dinâmicos) nas 3 abas
- [x] ADM Trabalhos: exibir nome do vendedor nos cards das 3 abas
- [x] ADM Trabalhos: botão para alterar o vendedor de uma venda (select com vendedores ativos)
- [x] Backend: procedure updateSeller + listActiveSellers (ADM) para alterar o vendedor de uma venda
- [x] Testes: 32 testes passando (4 novos para updateSeller e listActiveSellers)

## Categorias de Trabalho (Individual, Promoção, Coletivo)
- [x] Migration: campo category (individual/promocao/coletivo) na tabela products
- [x] Backend: atualizar procedures create/update/list de products para incluir category
- [x] Backend: incluir productCategory nas procedures de vendas (toWrite/pending/done/sales) via JOIN
- [x] Frontend ADM - Trabalhos Espirituais: 3 abas (Individuais, Promoção, Coletivos)
- [x] Frontend ADM - Trabalhos Espirituais: campo de categoria no formulário de adicionar/editar
- [x] Frontend Nova Venda: tag visual "Promoção" e "Coletivo" no select de trabalhos
- [x] Frontend cards de trabalhos (ADM e Consultora): exibir tag de categoria nos cards
- [x] Frontend painel Trabalhos (ADM e Consultora): sub-filtro de categoria (Todos/Promoção/Coletivos)
- [x] 32 testes passando

## Bug: SellerEditInline
- [x] listActiveSellers filtra só vendedores — deve incluir todos os funcionários ativos (vendedor, consultora, admin)
- [x] Bug do X: ao cancelar edição de vendedor, o card fica "Sem vendedor" em vez de manter o valor original
- [x] Venda com sellerName null corrigida diretamente no banco (Wilson)

## UX e Validações
- [x] Mover Sonner toaster para canto inferior direito (bottom-right) em todo o sistema
- [x] Nova Venda: validação de data de nascimento mínima de 18 anos antes de registrar

## UX Cards de Trabalhos
- [x] ADM e Consultora: card inteiro clicável para expandir (não só a setinha), badge do vendedor continua clicável separadamente

## Refactor Sub-filtro de Categoria
- [x] ADM Trabalhos: 2 níveis separados — nível 1 (categoria: Todos/Individual/Promoção/Coletivo) + nível 2 (tipo de trabalho dentro da categoria selecionada)
- [x] Consultora: mesma lógica de 2 níveis

## Correções ADM Trabalhos
- [x] Corrigir sub-filtro de categoria: nomes dos produtos corrigidos no banco (sem categoria no nome)
- [x] ADM: botão para voltar trabalho de Pendente → Para Escrever (somente ADM)

## Categoria nas Vendas
- [x] Banco: migration adicionou coluna productCategory na tabela sales; UPDATE populou vendas existentes via JOIN com products
- [x] Backend: novas vendas salvam productCategory (snapshot do produto via getProductById); consultora.ts usa sales.productCategory diretamente (sem JOIN)
- [x] Frontend: tag de categoria na coluna Trabalho da tabela Todas as Vendas (⭐ Promoção / 👥 Coletivo)
- [x] Frontend: filtro Tipo (Todos/Individual/Promoção/Coletivo) na tela Todas as Vendas (client-side)

## Reestruturação de Categorias (Opção A)
- [x] Banco: deletar todas as vendas de teste e produtos duplicados (Amarração/Limpeza Promoção e Coletivo)
- [x] Banco: remover coluna category da tabela products (migration gerada e aplicada)
- [x] Schema Drizzle: remover campo category de products
- [x] Backend products: remover category de create/update/list
- [x] Backend sales.create: receber productCategory diretamente do formulário (não buscar no produto)
- [x] Frontend Nova Venda: adicionar campo "Tipo" (Individual/Promoção/Coletivo) logo após seleção do trabalho
- [x] Frontend ADM Produtos: remover campo categoria do formulário de adicionar/editar produto (lista simples)
- [x] Testes: 32 passando

## Bug: Clique no card de trabalho
- [x] Corrigir área clicável do card nos painéis de Trabalhos (ADM e Consultora): removido stopPropagation desnecessario do div do nome do cliente

## Bug: Status dos Trabalhos no Dashboard ADM
- [x] Prazo e Dias Restantes aparecem como — para status "Para Escrever" (corrigido: backend agora retorna daysRemaining/deadline/isOverdue/isUrgent para toWrite igual ao pending)
- [x] Prazo calculado como data da venda + 7 dias úteis com feriados brasileiros (Carnaval, Sexta Santa, Páscoa, Corpus Christi, fixos nacionais) via shared/businessDays.ts

## Alertas, PWA e Restrição de Data
- [x] Corrigir cálculo de dias restantes: não contar o dia da venda (mostrar 7d quando venda é hoje)
- [x] Borda colorida nos cards Para Escrever: laranja (1-2 dias), vermelha (atrasado) — ADM e Consultora
- [x] Aba Alertas no painel ADM (/admin/alertas): lista permanente de trabalhos urgentes/atrasados (Para Escrever + Pendentes)
- [x] Aba Alertas no painel Consultora: nova aba na página Consultora
- [x] Web Push + PWA: service worker (sw.js), manifest.json, subscription no banco (push_subscriptions), botão Bell no DashboardLayout, job automático alertsJob.ts (a cada hora)
- [x] Restringir data de venda: vendedor e consultora só visualizam (readonly), ADM pode editar
- [x] 32 testes passando, TypeScript sem erros

## Otimizações de Performance
- [x] Pool de conexões MySQL otimizado: connectionLimit 20, connectTimeout 10s, idleTimeout 60s
- [x] QueryClient com staleTime global de 30s (evita re-fetches desnecessários ao trocar de aba)
- [x] Retry inteligente: 1 retry em erros de rede, sem retry em 4xx/5xx
- [x] refetchOnWindowFocus desabilitado (evita queries ao voltar para a aba)
- [x] Query worksSummary: retorna toWrite + pending em paralelo (Promise.all) para o Dashboard ADM
- [x] statusCounts otimizado: GROUP BY no banco em vez de SELECT * + contar em JS
- [x] Dashboard ADM: usa worksSummary (1 query) em vez de consultora.pending + consultora.toWrite (2 queries)

## Correção de Lentidão (Causa Raiz: refetchInterval + dynamic imports)
- [x] Identificado: refetchInterval: 60000 no Dashboard ADM causava query ao banco a cada 60s
- [x] Identificado: refetchInterval: 30000 no statusCounts da Consultora causava query a cada 30s
- [x] Identificado: refetchInterval: 5min nas páginas Alertas (ADM e Consultora)
- [x] Identificado: dynamic imports dentro de sendPushToRoles causavam overhead desnecessário
- [x] Identificado: caracteres unicode box-drawing (─) no consultora.ts causavam erro de compilação esbuild
- [x] Corrigido: todos os refetchInterval removidos — substituídos por staleTime (dados ficam frescos por 2-3min, sem polling automático)
- [x] Corrigido: webpush.ts com imports estáticos e envio paralelo com Promise.allSettled
- [x] Corrigido: caracteres unicode box-drawing no consultora.ts (7 linhas)
- [x] 32 testes passando

## Correção Tela Branca e Lentidão (Bundle JS gigante)
- [x] Aplicar React.lazy() em todas as páginas do App.tsx (code splitting por rota)
- [x] Converter import XLSX estático para dynamic import no Relatorios.tsx
- [x] Adicionar manualChunks no vite.config.ts (react-core, trpc-query, radix-ui, charts)
- [x] Remover @import Google Fonts duplicado do index.css (já estava no index.html)
- [x] Bundle inicial: de 1.9 MB para 114 kB (redução de 94%)
