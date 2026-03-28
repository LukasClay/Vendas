# 📚 GUIAS E DOCUMENTAÇÃO - Consolidado

Documentação de guias, scripts de teste e configurações.

---

## 📑 Índice
1. [Guia de Configuração do Storage](#guia-de-configuração-do-storage)
2. [Script de Teste v1.9.0](#script-de-teste-v190)

---

# Guia de Configuração do Storage

## Para: Configuração de Comprovantes em Nuvem

Para que os vendedores possam anexar comprovantes nas vendas, o sistema precisa de um lugar para guardar essas imagens. O banco de dados não é feito para guardar arquivos grandes, por isso usamos um serviço de **Storage** (Armazenamento em Nuvem).

O código já está 100% preparado para usar qualquer serviço compatível com o padrão **S3**. As opções recomendadas são o **Cloudflare R2** ou o **Supabase Storage**.

Abaixo, passo a passo usando o **Cloudflare R2**, que tem plano gratuito de 10 GB e sem taxa de transferência.

---

## Passo 1: Criar a Conta e o Bucket no Cloudflare R2

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com/) e crie uma conta
2. No menu lateral, clique em **R2** e depois em **Overview**
3. Se primeira vez, adicione cartão de crédito para ativar R2
   - ℹ️ Plano gratuito: 10 GB, suficiente para milhares de comprovantes
4. Clique em **Create bucket**
5. Dê um nome (ex: `vendas-magia-comprovantes`) — será a variável `S3_BUCKET`
6. Escolha região (ex: "North America") e clique **Create bucket**

---

## Passo 2: Permitir Acesso Público às Imagens

Para exibir a imagem do comprovante no painel, o bucket precisa de acesso público de leitura.

1. Na aba **Settings** do bucket
2. Procure **Public Access**
3. Em "R2.dev subdomain", clique **Allow Access**
4. Confirme digitando "allow"
5. Cloudflare gera URL pública (ex: `https://pub-xxxxxx.r2.dev`) — será `S3_PUBLIC_URL`

---

## Passo 3: Criar as Chaves de Acesso (Tokens)

Crie uma "senha" para o Railway fazer upload das imagens.

1. Volte a **Overview** de R2
2. Canto superior direito: **Manage R2 API Tokens**
3. **Create API token**
4. Dê nome (ex: `Railway Vendas`)
5. Em **Permissions**, mude para **Object Read & Write**
6. **Create API Token**

**⚠️ NÃO feche a tela!** Você precisa copiar:
- **Access Key ID** → `S3_ACCESS_KEY`
- **Secret Access Key** → `S3_SECRET_KEY`
- **Endpoint for S3 Clients** → `S3_ENDPOINT` (termina em `.r2.cloudflarestorage.com`)

---

## Passo 4: Configurar o Railway

1. Acesse painel do projeto em [Railway](https://railway.app/)
2. Clique no serviço (aplicativo web)
3. Aba **Variables**
4. Adicione as 5 variáveis:

| Nome | O que colocar |
| :--- | :--- |
| `S3_ENDPOINT` | URL "Endpoint for S3 Clients" do Passo 3 |
| `S3_BUCKET` | Nome do bucket (ex: `vendas-magia-comprovantes`) |
| `S3_ACCESS_KEY` | "Access Key ID" do Passo 3 |
| `S3_SECRET_KEY` | "Secret Access Key" do Passo 3 |
| `S3_PUBLIC_URL` | URL pública do Passo 2 (ex: `https://pub-xxxxxx.r2.dev`) |

---

## Passo 5: Instalar o SDK

O código precisa da biblioteca AWS SDK para comunicar com o bucket.

1. Abra `package.json`
2. Instale no terminal:
   ```bash
   npm install @aws-sdk/client-s3
   # ou pnpm add @aws-sdk/client-s3
   ```
3. Faça commit e push para GitHub

**Pronto!** Assim que o Railway fizer o novo deploy, o sistema de upload estará **100% funcional**.

---

# Script de Teste v1.9.0

## 🧪 Script de Teste - Mundo Da Magia

Para validar as novas funcionalidades e melhorias de UI/UX do Painel ADM.

---

## 1. Interface e Sidebar (Visual)

- [ ] **Animação do Logo**: Texto "Mundo Da Magia" na sidebar com brilho dourado (shimmer) suave
- [ ] **Highlight de Ativo**: Entre "Dashboard" e "Relatórios", destaque na lateral acompanha página correta
- [ ] **Tamanho da Fonte**: Textos legíveis, ícones maiores

---

## 2. Dark Mode (Tema Escuro)

- [ ] **Toggle de Tema**: Ícone Sol/Lua no topo alterna claro ↔ escuro
- [ ] **Persistência**: Mude para Dark Mode, atualize (F5). Sistema permanece em Dark Mode
- [ ] **Cores Douradas**: Dark Mode mantém identidade visual dourada, textos legíveis

---

## 3. Animações (Framer Motion)

- [ ] **Entrada de Página**: Ao trocar de aba, conteúdo entra com fade-in suave
- [ ] **Cards do Dashboard**: Cards de resumo (Total Vendido, Vendas) "sobem" ao carregar
- [ ] **Listas Staggered**: Itens das listas (Top Vendedores, Últimas Vendas) entram um após outro

---

## 4. Relatórios e E-mail (Funcional)

- [ ] **Botão de Teste**: **Relatórios > Relatórios Automáticos**. Envelope (📧) ao lado do email
- [ ] **Recebimento**: Verifique inbox + spam por resumo profissional
- [ ] **Layout do E-mail**: Logo, cards de resumo, tabelas com design dourado

---

## 5. Configurações (Minha Conta)

- [ ] **Nome da Página**: Menu diz "Minha Conta", título atualizado
- [ ] **Versão**: Final da página mostra **1.9.0**

---

## 🐛 Relatório de Erros

*Em caso de qualquer comportamento inesperado, por favor, reporte!*

---

*Consolidação de Guias e Documentação em 27/03/2026*
