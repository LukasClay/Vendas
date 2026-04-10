# Mundo Da Magia LTDA — Guia Permanente de Desenvolvimento

> Este arquivo é o documento vivo mais importante do projeto. Contém as regras de arquitetura, UX, negócio e segurança que não devem ser violadas. Leia antes de qualquer alteração.
> Para o histórico completo de funcionalidades implementadas, consulte `docs/historico.md`.

---

## 📜 Guia do Projeto: Regras, Restrições e Padrões

> Esta seção tem prioridade sobre qualquer outra instrução. Qualquer desenvolvedor ou IA que atuar neste projeto deve lê-la antes de qualquer alteração.

### 1. Regras de Ouro (O que NÃO fazer)

- **Painéis Consultora e Vendedor são intocáveis:** Nenhuma alteração visual ou funcional deve ser aplicada a esses painéis sem autorização explícita do dono do projeto. Se for necessário modificar arquivos compartilhados, as mudanças devem ser isoladas (via condicionais de `role`) para não afetar a aparência ou as funcionalidades atuais desses painéis.
- **Foco atual no ADM:** O foco de desenvolvimento e melhorias visuais é exclusivamente o painel ADM. Qualquer mudança que afete os painéis da Consultora ou do Vendedor deve ser previamente consultada.
- **Não presuma, pergunte:** Antes de remover funcionalidades que parecem "desnecessárias" ou aplicar mudanças cosméticas do ADM nos outros painéis, pergunte ao dono do projeto. Avalie cuidadosamente as dependências antes de qualquer remoção.
- **Toda ação importante exige aprovação:** Commits, pushes, merges e qualquer operação irreversível só devem ser executados após confirmação explícita do usuário. Nunca aja por antecipação.

### 2. Padrões de Interface e UX

- **Painel ADM (Desktop First, Mobile Ready):** O ADM é usado 99% do tempo em desktop — deve ser otimizado para telas grandes (layout amplo, tabelas completas, colunas lado a lado). A responsividade mobile deve ser mantida para uso emergencial.
- **Performance Mobile (Consultora e Vendedor):** Vendedoras e consultoras acessam pelo celular próprio, frequentemente com internet móvel limitada (3G/4G fraco). Qualquer regressão de performance nessas telas impacta diretamente o trabalho delas. Ver seção ⚡ Regras de Performance.
- **Notificações e Alertas:** O botão de notificação (PushNotificationButton) e a aba "Alertas" aparecem **apenas** nos painéis ADM e Consultora. O painel do Vendedor é estritamente focado em "Nova Venda" e "Minhas Vendas".
- **Identidade Visual:** O nome oficial é **"Mundo Da Magia LTDA"** (tela de login, cabeçalho e todo o sistema). Tipografia _Playfair Display_ para títulos, paleta elegante com suporte a múltiplos temas por empresa no ADM.
- **Efeitos Visuais:** Animações (framer-motion) são permitidas **apenas no ADM**. Nos painéis de Vendedora e Consultora use CSS simples ou nada — cada KB e cada ms de render importam.

### 3. Regras de Negócio e Arquitetura

- **Paridade ADM e Consultora:** Toda funcionalidade implementada para a Consultora deve ter um equivalente acessível no ADM.
- **Lixeira de Vendas (Soft Delete):** Venda excluída vai para a Lixeira por 30 dias — não aparece em dashboards nem relatórios, mas pode ser restaurada. Exclusão permanente automática após 30 dias.
- **Desativação de Funcionários:** Ao desativar, o `username` recebe sufixo `_old` (ex: `joao_old`), liberando o username original. O nome com sufixo aparece nas vendas históricas para rastreabilidade.
- **Categoria da Venda, não do Produto:** A `productCategory` (Individual/Promoção/Coletivo) é definida no momento da venda e salva como snapshot em `sales.productCategory`. A tabela `products` não tem campo de categoria.
- **Otimização de Banco e Queries:** Mantenha `staleTime` no React Query, nunca use `refetchInterval` agressivo, estabilize inputs de queries com `useMemo` e evite re-renders desnecessários.

### 4. Mindset de Desenvolvimento

- Aja como Tech Lead sênior: pense nas consequências de cada linha antes de escrever.
- Se uma refatoração for necessária para uma nova feature, garanta que o comportamento anterior seja estritamente mantido.
- Entregue código limpo, componentizado e tipado (TypeScript, sem erros de compilação).
- Para alterações grandes: faça um plano, explique o impacto e **peça aprovação antes de implementar**.

---

## 📌 Regra de Versionamento (para qualquer IA ou dev que alterar o código)

Ao finalizar alterações, avalie o peso das mudanças feitas, consulte a versão atual em `client/src/pages/admin/Configuracoes.tsx` e atualize de acordo:

| Tipo de mudança                            | Incremento | Exemplo (partindo de 2.3.0) |
| ------------------------------------------ | ---------- | --------------------------- |
| Pequena (fix, ajuste visual, texto)        | `+0.0.1`   | 2.3.0 → 2.3.1               |
| Média (nova feature, melhoria relevante)   | `+0.1.0`   | 2.3.0 → 2.4.0               |
| Grande (novo sistema, refactor estrutural) | `+1.0.0`   | 2.3.0 → 3.0.0               |

> A versão atual está sempre em `client/src/pages/admin/Configuracoes.tsx` — não é mantida aqui para evitar desatualização.

---

## 🏗️ Arquitetura & Stack

| Camada   | Tecnologia                                       |
| -------- | ------------------------------------------------ |
| Frontend | React + Vite + TailwindCSS + shadcn/ui           |
| Backend  | Express + tRPC (type-safe end-to-end)            |
| Banco    | PostgreSQL (Railway) via Drizzle ORM             |
| Storage  | Cloudflare R2 (S3-compatible) — plano free: 10GB |
| Auth     | JWT + sessionVersion (invalidação forçada)       |
| Deploy   | Railway — branch `main` = produção automática    |

**Migrations:** não usar `drizzle-kit push` em produção — usar `ensureXxxColumns()` no startup (`server/db.ts`) com `ALTER TABLE IF NOT EXISTS`. Padrão já estabelecido para `isSystem` e `photoColumns`. Nunca adicionar Pre-deploy Command de migration no Railway.

---

## ⚡ Regras de Performance — CRÍTICO

> **Contexto:** Vendedoras e consultoras acessam o sistema pelo celular próprio, frequentemente com internet móvel limitada (3G/4G fraco). Qualquer regressão de performance nessas telas impacta diretamente o trabalho delas.

### Painéis prioritários (do mais crítico ao menos crítico)

1. `NovaVenda.tsx` — vendedora registra venda no celular, muitas vezes em campo
2. `Consultora.tsx` — consultora consulta trabalhos pendentes pelo celular
3. `admin/*` — ADM geralmente acessa via desktop/Wi-Fi, menor criticidade

### O que NUNCA fazer nos painéis de vendedora e consultora

- **Não adicionar animações** (framer-motion, transitions pesadas) — use CSS simples ou nada
- **Não carregar dependências novas** sem avaliar o impacto no bundle — cada KB importa
- **Não fazer queries adicionais** no carregamento inicial da página — cada request é latência extra
- **Não renderizar componentes pesados** condicionalmente sem lazy loading
- **Não usar `useEffect` para buscar dados** — usar tRPC queries diretamente (já tem cache)
- **Não adicionar imagens sem dimensões fixas** — causa layout shift (CLS) perceptível em mobile

### O que é permitido no ADM (menor criticidade)

- Animações com framer-motion ✓
- Modais complexos com múltiplos estados ✓
- Tabelas com muitos dados e filtros ✓
- Dependências extras de visualização ✓

### Checklist antes de qualquer PR que toque em `NovaVenda.tsx` ou `Consultora.tsx`

- [ ] A mudança adiciona alguma dependência nova ao bundle?
- [ ] Há novas chamadas de API no carregamento inicial?
- [ ] Há animações ou transições adicionadas?
- [ ] O componente renderiza corretamente em tela de 375px (iPhone SE)?
- [ ] A mudança funciona com conexão lenta (simular throttling no DevTools)?

---

## 🗂️ Estrutura de Pastas Relevante

```
server/
  _core/
    index.ts             ← startup: ensureSystemProducts, ensurePhotoColumns, jobs
  db.ts                  ← todas as funções de banco + auto-migrações (ensureXxx)
  routers/
    auth.ts              ← login, logout, me
    users.ts             ← CRUD de funcionários (admin)
    products.ts          ← CRUD de produtos/trabalhos (admin)
    sales.ts             ← criar/editar/deletar vendas, upload comprovante + fotos
    consultora.ts        ← queries para painel da consultora (toWrite, pending, done)
    consultationSlots.ts ← agendamento de horários de Consulta Cartas
    reports.ts           ← totais, rankings, exportação Excel/PDF
    security.ts          ← sessões ativas, desconexão forçada, audit log
    push.ts              ← Web Push notifications (subscribe, send)
    settings.ts          ← configurações do sistema
  jobs/
    alertsJob.ts         ← envia push de trabalhos urgentes/atrasados (8h e 18h)
    reportsJob.ts        ← envia relatórios automáticos por email (diário/semanal/mensal)

client/src/pages/
  Login.tsx              ← autenticação (username + senha)
  NovaVenda.tsx          ← formulário de nova venda (vendedora/consultora) ⚡ CRÍTICO
  Consultora.tsx         ← painel de trabalhos da consultora ⚡ CRÍTICO
  MinhasVendas.tsx       ← histórico de vendas do vendedor logado
  Consultas.tsx          ← painel de consultas agendadas (consultora)
  admin/
    Dashboard.tsx        ← gráficos, métricas e resumos
    Vendas.tsx           ← todas as vendas + modal de detalhes + modal de edição
    Trabalhos.tsx        ← painel de trabalhos do ADM (Para Escrever/Pendentes/Feitos)
    Consultas.tsx        ← gestão de horários de Consulta Cartas (ADM)
    Alertas.tsx          ← lista permanente de trabalhos urgentes/atrasados
    Vendedores.tsx       ← gestão de funcionários (criar, editar, desativar)
    Produtos.tsx         ← gestão de produtos/trabalhos espirituais
    Relatorios.tsx       ← exportação Excel/PDF + relatórios automáticos por email
    Lixeira.tsx          ← vendas excluídas (soft delete, restauração, exclusão permanente)
    Seguranca.tsx        ← sessões ativas, desconexão forçada, audit log
    Configuracoes.tsx    ← configurações gerais + versão atual do sistema

shared/
  const.ts               ← constantes globais (TYPES_WITH_PHOTOS, COOKIE_NAME, etc.)
  types.ts               ← tipos compartilhados entre frontend e backend
  businessDays.ts        ← cálculo de dias úteis com feriados brasileiros

drizzle/
  schema.ts              ← fonte da verdade do schema do banco
```

---

## 🔒 Regras de Segurança

- **Nunca expor** `attachmentKey` ou `photoKey` para o frontend — apenas as URLs públicas
- **Validar tamanho e MIME** tanto no cliente quanto no servidor (já implementado)
- **Toda ação sensível** (deletar venda, desconectar usuário, exportar dados) deve gerar audit log em `createAuditLog()`
- **Uploads** vão para paths separados: `comprovantes/{userId}/` e `fotos/{userId}/` — nunca misturar
- **`adminProcedure`** para tudo que o ADM faz — nunca usar `protectedProcedure` em rotas de admin

---

## 📦 Cloudflare R2 — Monitoramento

- **Plano free:** 10GB storage, 1M writes/mês, 10M reads/mês
- **Consumo atual estimado:** ~150MB/mês (comprovantes) + fotos individuais a partir da v2.3.0
- **Paths:** `comprovantes/{userId}/{nanoid}.ext` e `fotos/{userId}/{nanoid}.ext`
- **Atenção:** arquivos órfãos (comprovante/foto trocados) não são deletados automaticamente — monitorar crescimento do bucket periodicamente
