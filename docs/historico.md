# Mundo Da Magia LTDA — Registro de Desenvolvimento

> Este arquivo tem dois propósitos: **changelog** (histórico cronológico de tudo que foi construído e corrigido) e **guia permanente** (regras de arquitetura, UX e negócio que não devem ser violadas). A seção de guia fica sempre ao final e é o documento vivo mais importante do projeto.

---

## Fundação do Sistema

### Banco de Dados
- [x] Schema: tabela users (com role vendedor/admin)
- [x] Schema: tabela products (trabalhos espirituais)
- [x] Schema: tabela sales (vendas com todos os campos)
- [x] Schema: tabela clients (clientes)
- [x] Schema: tabela report_schedules (agendamentos de email)
- [x] Executar migration SQL

### Backend (tRPC Routers)
- [x] Router: auth (me, logout)
- [x] Router: users (listar, criar, editar, remover — admin)
- [x] Router: products (listar, criar, editar, remover — admin)
- [x] Router: sales (criar, listar, filtrar, detalhar)
- [x] Router: reports (totais, ranking vendedores, ranking clientes, por período)
- [x] Upload de comprovante para S3
- [x] Exportação Excel (xlsx)
- [x] Exportação PDF (jspdf + autotable)
- [x] Envio automático de relatórios por email (diário, semanal, mensal)

### Frontend — Layout e Design
- [x] Design system: cores douradas, tipografia Playfair Display, tema elegante
- [x] DashboardLayout com sidebar adaptada por role
- [x] Página de login/autenticação
- [x] Roteamento por role (vendedor vs admin) com AuthGuard

### Frontend — Vendedor
- [x] Formulário de nova venda
- [x] Upload de comprovante (PDF/imagem, máx 5MB, drag-and-drop)
- [x] Confirmação visual de venda registrada
- [x] Histórico de vendas do vendedor logado

### Frontend — Administrador
- [x] Dashboard com métricas principais (cards de totais)
- [x] Gráfico de vendas por mês (Recharts)
- [x] Tabela de todas as vendas com filtros (data, vendedor, produto)
- [x] Gestão de produtos (adicionar, editar, remover, ativar/desativar)
- [x] Gestão de usuários/vendedores (editar, promover, desativar)
- [x] Ranking de melhores clientes e melhores vendedores
- [x] Exportar relatório em Excel e PDF
- [x] Configuração de relatórios automáticos por email (diário, semanal, mensal)
- [x] Página de configurações

### Testes e Deploy
- [x] Testes unitários dos routers principais (13 testes passando)
- [x] Verificação de controle de acesso por role
- [x] Deploy no Railway

---

## Login Próprio (username/senha)

Substituição do fluxo OAuth herdado do SDK por autenticação local completa.

- [x] Adicionar campos `passwordHash` e `username` único no schema (migrations)
- [x] Backend: login por username + senha, sem dependência de email ou OAuth
- [x] Backend: criação de usuário pelo admin com username, senha e tipo
- [x] Backend: endpoint de edição completa de qualquer usuário (nome, username, senha, tipo)
- [x] Frontend: tela de login com campo "Usuário" (substituiu campo de email)
- [x] Frontend: cadastro unificado em "Novo Funcionário" com seleção de tipo
- [x] Frontend: gestão completa de funcionários pelo ADM
- [x] Remover botão "Promover a Admin" da interface
- [x] Renomear sistema para "Mundo Da Magia LTDA" (login, cabeçalho, título)
- [x] Bug: corrigir erro "Failed query" ao fazer login com email/senha
- [x] Bug: retry automático de conexão com o banco ao acordar da hibernação

---

## Perfil Consultora

Novo role com painel próprio, sem acesso a valores financeiros.

- [x] Role "consultora" no schema e migration
- [x] Rotas protegidas por role (consultora só acessa tela dela)
- [x] Backend: endpoint de trabalhos pendentes por prioridade (7 dias úteis)
- [x] Backend: endpoint de histórico de compras por nome do cliente
- [x] Tela da Consultora: lista de trabalhos por prioridade, busca por nome do trabalho
- [x] Tela da Consultora: botões de copiar dados (nome, data de nascimento, telefone, observação)
- [x] Tela da Consultora: sem acesso ao valor da venda
- [x] Tela da Consultora: histórico de compras do cliente (quantas vezes comprou)
- [x] Tela da Consultora: marcar trabalho como concluído
- [x] Painel admin: separar cadastro de Vendedor e Consultora
- [x] Otimização de performance mobile (celulares antigos)
- [x] Bug: corrigir redirecionamento inicial da consultora para tela correta
- [x] Bug: corrigir label "Vendedor" para "Consultora" no DashboardLayout

---

## Reestruturação do Painel Consultora

Status de trabalhos em 3 etapas, com regra de prazo em dias úteis.

- [x] Schema: campo `workStatus` (para_escrever, pendente, feito) na tabela sales
- [x] Backend: cálculo de prazo — 7 dias úteis (seg-sex) a partir do dia seguinte à venda
- [x] Backend: endpoints de transição de status (escrever→pendente, pendente→feito, feito→pendente)
- [x] Consultora: acesso ao formulário de vendas (igual ao vendedor)
- [x] Consultora: 3 abas com badges de contagem (Para Escrever, Pendentes, Feitos)
- [x] Consultora: aba Feitos mostra mais recentes no topo para fácil reversão
- [x] Consultora: botão "Copiar Tudo" na aba Para Escrever
- [x] Consultora: confirmação antes de marcar como feito

---

## Melhorias Gerais de Sistema e Painel Admin

- [x] Renomear "Vendedores" para "Funcionários" em todo o sistema (menu, páginas, labels, rotas)
- [x] Adicionar campo Observação no formulário de vendas (vendedor/consultora)
- [x] Tornar data de nascimento e telefone obrigatórios no formulário de nova venda
- [x] Adicionar seção de dias restantes/urgência no painel admin (similar ao painel da consultora)
- [x] Otimizar painel admin para desktop: layout amplo, tabelas completas, colunas lado a lado
- [x] Painel Funcionários: botão "Novo Admin" para criar outros administradores

### Segurança e Controle de Acesso
- [x] Frontend: guard de rota `/admin` bloqueia vendedor e consultora com redirecionamento imediato
- [x] Backend: `adminProcedure` revisada em todos os routers (products, users, reports, sales admin)

### Gestão de Vendas (Admin)
- [x] Botão "Editar" venda — altera qualquer campo
- [x] Botão "Excluir" venda — com confirmação
- [x] Botão "Exportar para CSV" na página Todas as Vendas
- [x] Filtro rápido por período (hoje/semana/mês) no dashboard

---

## Responsividade Mobile

### Fundação Mobile
- [x] DashboardLayout: sidebar como menu hamburguer no mobile
- [x] Formulário de nova venda: otimizado para celular (inputs grandes, teclado numérico, UX simples)
- [x] Painel admin: dashboard, vendas, produtos e vendedores responsivos no mobile

### Varredura Mobile do Painel Admin (uso emergencial)
- [x] Edição de vendas (modal) no celular
- [x] Tabela de vendas no celular (scroll horizontal ou layout adaptado)
- [x] Gestão de funcionários no celular (edição inline, reset senha)
- [x] Gestão de produtos no celular
- [x] Dashboard (filtros, gráficos, cards) no celular
- [x] Exportação (Excel/PDF) no celular

---

## Funcionalidade Consulta Cartas

Sistema de agendamento de horários vinculado ao trabalho "Consulta Cartas".

- [x] Schema: tabela `consultation_slots` (data, hora, vendida, sale_id)
- [x] Backend: seed automático do trabalho "Consulta Cartas" no banco
- [x] Backend: procedures tRPC para consultation_slots (listar disponíveis, criar, deletar)
- [x] Backend: procedure de venda com `consultation_slot_id` quando trabalho = Consulta Cartas
- [x] Formulário Nova Venda: campo de horário de consulta condicional ao selecionar Consulta Cartas
- [x] Formulário Nova Venda (Consultora): igual ao vendedor + botão de adicionar nova data/horário
- [x] Aba "Consultas" no painel da Consultora: Pendentes e Realizadas
- [x] Consultora: adicionar datas/horários de consulta diretamente no painel
- [x] Aba "Consultas" no painel do ADM (dentro de Trabalhos): visão geral + gerenciar datas
- [x] ADM: adicionar/remover datas e horários de consulta
- [x] Backend: retornar dados da venda (vendedor, cliente, nascimento, telefone) junto com slot vendido
- [x] Remover "Consulta Cartas" da aba de Trabalhos do ADM e da Consultora (seção dedicada)
- [x] Adicionar seção de Consultas no histórico de compras de uma cliente (ADM e Consultora)
- [x] Procedure `clientHistory` para ADM (`sales.clientHistory`)
- [x] Modal de histórico de cliente na tela Todas as Vendas do ADM (botão no nome da cliente)
- [x] `listAvailable`: filtrar por data+hora atual — slots de hoje com horário passado somem automaticamente
- [x] `listAll`: ocultar slots não vendidos que já passaram (mantém vendidos no histórico)

### Sistema de Status de Consultas (pendente / realizada / cancelada)
- [x] Schema: campo `status` na tabela `consultation_slots`
- [x] Backend: lógica automática +50min para marcar como realizada nas queries
- [x] Backend: procedures cancelar (consultora e ADM), restaurar (só ADM), listCancelled
- [x] Frontend Consultora: botão Cancelar nos cards pendentes + aba "Cartas Canceladas" (visualização)
- [x] Frontend ADM: aba "Cartas Canceladas" com botões Restaurar e Liberar Horário
- [x] Backend: procedure `deleteCancelled` (só ADM) — apaga slot cancelado, liberando o horário
- [x] Testes: 28 testes passando (cobertura completa de consultationSlots)

### Motivo de Cancelamento
- [x] Migration: campo `cancelReason` (texto opcional) na tabela `consultation_slots`
- [x] Backend: `cancelReason` incluído no procedure cancel
- [x] Frontend ADM e Consultora: campo de motivo no modal de confirmação de cancelamento
- [x] Frontend: exibir motivo do cancelamento no card cancelado
- [x] Backend: notificação ao ADM quando consulta for cancelada (push notification)

---

## Integridade de Dados (Soft Delete e Snapshots)

- [x] Soft delete de funcionários: snapshot (nome, username, role) salvo nas vendas antes de marcar como deletado — histórico financeiro preservado
- [x] Soft delete de trabalhos (products): snapshot do `productName` salvo nas vendas — histórico preservado
- [x] Desativação de funcionário: `username` recebe sufixo `_old` (ex: `joao_old`), liberando o username original para novos cadastros

---

## Painel de Trabalhos (ADM)

Paridade completa com o painel da Consultora.

- [x] Painel de Trabalhos para o ADM: abas "Para Escrever", "Pendentes" e "Realizados"
- [x] ADM pode alterar status de trabalhos (para_escrever → pendente → feito) e visualizar todos
- [x] ADM: botão para voltar trabalho de Pendente → Para Escrever (exclusivo do ADM)
- [x] Backend: `sellerName` incluído nas procedures toWrite/pending/done da Consultora
- [x] Frontend Consultora e ADM: nome do vendedor exibido nos cards de trabalho
- [x] Frontend ADM: rota `/admin/trabalhos` e item no menu lateral

---

## Categorias de Trabalho (Individual, Promoção, Coletivo)

Categoria definida no momento da venda, não no cadastro do produto.

- [x] Schema: campo `productCategory` na tabela sales (snapshot por venda)
- [x] Backend `sales.create`: recebe `productCategory` diretamente do formulário
- [x] Backend: `productCategory` incluído nas procedures toWrite/pending/done/sales
- [x] Frontend Nova Venda: campo "Tipo" (Individual/Promoção/Coletivo) após seleção do trabalho
- [x] Frontend Nova Venda: tags visuais "Promoção" e "Coletivo" no select de trabalhos
- [x] Frontend ADM Produtos: lista simples, sem campo categoria (categoria é da venda, não do produto)
- [x] Frontend painel Trabalhos (ADM e Consultora): 2 níveis de filtro — categoria → tipo de trabalho
- [x] Frontend Todas as Vendas: tag de categoria na coluna Trabalho (⭐ Promoção / 👥 Coletivo) + filtro client-side
- [x] Banco: remoção da coluna `category` da tabela products (migration aplicada)
- [x] Testes: 32 testes passando

### Filtros e UX dos Cards
- [x] Filtro por tipo de trabalho (chips dinâmicos) nas 3 abas — mostra apenas tipos presentes naquela aba
- [x] ADM Trabalhos: botão para alterar o vendedor de uma venda (select com funcionários ativos)
- [x] Backend: procedures `updateSeller` + `listActiveSellers` — inclui todos os roles ativos (vendedor, consultora, admin)
- [x] Card inteiro clicável para expandir (badge do vendedor continua clicável separadamente)
- [x] Bug: ao cancelar edição de vendedor inline, card voltava "Sem vendedor" em vez do valor original
- [x] Bug: venda com `sellerName` null corrigida diretamente no banco

---

## Alertas, PWA e Restrição de Data

- [x] Prazo calculado como data da venda + 7 dias úteis, com feriados brasileiros via `shared/businessDays.ts`
- [x] Bug: cálculo de dias restantes não contava o dia da venda (corrigido para mostrar 7d quando venda é hoje)
- [x] Borda colorida nos cards Para Escrever: laranja (1–2 dias), vermelha (atrasado) — ADM e Consultora
- [x] Bug: Prazo e Dias Restantes apareciam como "—" para status "Para Escrever" (backend agora retorna daysRemaining/deadline/isOverdue/isUrgent para toWrite, igual ao pending)
- [x] Aba Alertas no painel ADM (`/admin/alertas`): lista permanente de trabalhos urgentes/atrasados
- [x] Aba Alertas no painel Consultora: aba dentro da página de Trabalhos
- [x] Botão de voltar na página de Alertas do ADM
- [x] Web Push + PWA: service worker (`sw.js`), `manifest.json`, subscription no banco (`push_subscriptions`), botão Bell no DashboardLayout, job automático `alertsJob.ts`
- [x] AlertsJob ajustado para rodar apenas às 8h e às 18h (antes rodava a cada hora)
- [x] Restringir data de venda: vendedor e consultora só visualizam (readonly), ADM pode editar

---

## Correções de Data e Timezone

- [x] Bug: data de venda exibida com 2 dias a menos — criado `dateUtils.ts` com `formatDate` sem timezone offset, aplicado em todos os arquivos
- [x] Bug: `saleDate` gravada com 1 dia a menos no banco (D-1) — corrigido na camada de persistência
- [x] Limpeza: vendas de teste removidas do banco (sales + consultation_slots)

---

## Performance e Estabilidade

### Otimizações de Query e Conexão
- [x] Pool de conexões MySQL: `connectionLimit 20`, `connectTimeout 10s`, `idleTimeout 60s`
- [x] `QueryClient` global: `staleTime: 30s`, `refetchOnWindowFocus: false`, retry inteligente (1x em erros de rede, 0x em 4xx/5xx)
- [x] `trpc.auth.me`: `staleTime: 5min` no `useAuth` — instâncias simultâneas compartilham 1 request
- [x] `localStorage.setItem()` removido do `useMemo` do `useAuth` — causava re-renders em cascata
- [x] `statusCounts` otimizado: `GROUP BY` no banco em vez de `SELECT *` + contagem em JS
- [x] `worksSummary`: retorna toWrite + pending em paralelo (`Promise.all`) para o Dashboard ADM

### Eliminação de Polling Agressivo
- [x] Identificados e removidos: `refetchInterval` no Dashboard ADM (60s), na Consultora (30s) e nas páginas de Alertas (5min)
- [x] Substituídos por `staleTime` — dados ficam frescos por 2–3min sem polling automático
- [x] `webpush.ts`: imports estáticos e envio paralelo com `Promise.allSettled`
- [x] Bug de compilação: caracteres unicode box-drawing (`─`) no `consultora.ts` causavam erro no esbuild

### Correção de Bundle e Tela Branca
- [x] `React.lazy()` aplicado em todas as páginas do `App.tsx` (code splitting por rota)
- [x] Import de XLSX convertido para dynamic import no `Relatorios.tsx`
- [x] `manualChunks` no `vite.config.ts`: react-core, trpc-query, radix-ui, charts, exports
- [x] `@import` Google Fonts duplicado removido do `index.css`
- [x] Bundle inicial: de 1,9 MB para 114 kB (redução de 94%)

### Correção de Loop Infinito de Queries (Dashboard ADM)
- [x] `currentYear` e `{ limit: 8 }` movidos para constantes fora do componente (inputs instáveis causavam re-renders)
- [x] `summaryInput` estabilizado com `useMemo` para não disparar re-fetch ao trocar de aba
- [x] Varredura completa de inputs instáveis em Vendas, Relatórios, Funcionários e Consultora

---

## UX e Polimento

- [x] Sonner toaster movido para canto inferior direito (bottom-right) em todo o sistema
- [x] Nova Venda: validação de data de nascimento mínima de 18 anos antes de registrar
- [x] Bug: inputs de edição de funcionários perdiam foco a cada caractere digitado — `UserCard` movido para fora do componente principal
- [x] Bug: área clicável do card de trabalho no `stopPropagation` desnecessário do div do nome da cliente — corrigido
- [x] Nova Venda para ADM: rota `/admin/nova-venda` (adminOnly) usando o mesmo formulário `NovaVenda`
