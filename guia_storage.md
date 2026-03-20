# Guia de Configuração do Storage (Comprovantes)

Para que os vendedores possam anexar comprovantes nas vendas, o sistema precisa de um lugar para guardar essas imagens. O banco de dados não é feito para guardar arquivos grandes, por isso usamos um serviço de "Storage" (Armazenamento em Nuvem).

O código já está 100% preparado para usar qualquer serviço compatível com o padrão **S3**. As opções mais fáceis, baratas e modernas hoje são o **Cloudflare R2** ou o **Supabase Storage**.

Abaixo, explico o passo a passo usando o **Cloudflare R2**, que é a opção mais recomendada por ter um plano gratuito muito generoso (10 GB de espaço) e não cobrar taxa de transferência.

---

## Passo 1: Criar a conta e o Bucket no Cloudflare R2

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com/) e crie uma conta (se ainda não tiver).
2. No menu lateral esquerdo, clique em **R2** e depois em **Overview** (Visão geral).
3. Se for a primeira vez, ele pedirá para você adicionar um cartão de crédito para ativar o R2. **Não se preocupe**, o plano gratuito (Free Tier) dá 10 GB de espaço, o que é mais do que suficiente para milhares de comprovantes. Você só será cobrado se passar disso.
4. Após ativar, clique no botão azul **Create bucket** (Criar bucket).
5. Dê um nome ao bucket (exemplo: `vendas-magia-comprovantes`). **Anote esse nome**, ele será a variável `S3_BUCKET`.
6. Escolha a região mais próxima de você (ex: "Auto" ou "North America") e clique em **Create bucket**.

---

## Passo 2: Permitir Acesso Público às Imagens

Para que o sistema consiga exibir a imagem do comprovante na tela do painel, o bucket precisa permitir acesso público de leitura.

1. Dentro do painel do bucket que você acabou de criar, vá na aba **Settings** (Configurações).
2. Role a página para baixo até encontrar a seção **Public Access** (Acesso Público).
3. Em "R2.dev subdomain", clique em **Allow Access** (Permitir Acesso).
4. Confirme digitando "allow" na caixa de texto.
5. O Cloudflare vai gerar uma URL pública para o seu bucket (algo como `https://pub-xxxxxx.r2.dev`). **Anote essa URL**, ela será a variável `S3_PUBLIC_URL`.

---

## Passo 3: Criar as Chaves de Acesso (Tokens)

Agora você precisa criar uma "senha" para que o seu sistema no Railway consiga enviar as imagens para o Cloudflare.

1. Volte ao menu principal do R2 (clicando em "R2" no menu lateral esquerdo) e vá em **Overview**.
2. No canto superior direito, clique em **Manage R2 API Tokens** (Gerenciar Tokens de API do R2).
3. Clique em **Create API token** (Criar Token de API).
4. Dê um nome ao token (ex: `Railway Vendas`).
5. Em **Permissions** (Permissões), mude de "Read" para **Object Read & Write** (Leitura e Escrita de Objetos). Isso é crucial para o sistema poder fazer o upload.
6. Clique em **Create API Token** no final da página.

**ATENÇÃO:** Uma tela aparecerá com várias informações. **Não feche essa tela ainda!** Você precisará copiar três coisas dela:
*   **Access Key ID:** (Será a variável `S3_ACCESS_KEY`)
*   **Secret Access Key:** (Será a variável `S3_SECRET_KEY`)
*   **Endpoint for S3 Clients:** (Será a variável `S3_ENDPOINT`. É uma URL que termina em `.r2.cloudflarestorage.com`)

---

## Passo 4: Configurar o Railway

Agora que você tem todas as informações, basta colocá-las no seu projeto no Railway.

1. Acesse o painel do seu projeto no [Railway](https://railway.app/).
2. Clique no seu serviço (o aplicativo web).
3. Vá na aba **Variables** (Variáveis).
4. Adicione as seguintes 5 variáveis com os valores que você anotou nos passos anteriores:

| Nome da Variável | O que colocar |
| :--- | :--- |
| `S3_ENDPOINT` | A URL "Endpoint for S3 Clients" do Passo 3. |
| `S3_BUCKET` | O nome que você deu ao bucket no Passo 1 (ex: `vendas-magia-comprovantes`). |
| `S3_ACCESS_KEY` | O "Access Key ID" do Passo 3. |
| `S3_SECRET_KEY` | O "Secret Access Key" do Passo 3. |
| `S3_PUBLIC_URL` | A URL pública gerada no Passo 2 (ex: `https://pub-xxxxxx.r2.dev`). |

## Passo 5: O Toque Final (Instalar o SDK)

O código atual já está preparado, mas ele precisa da biblioteca da Amazon (AWS SDK) instalada no Railway para conseguir se comunicar com o bucket.

1. Vá no seu código, abra o arquivo `package.json`.
2. Adicione a biblioteca `@aws-sdk/client-s3` nas dependências. O jeito mais fácil de fazer isso é rodar este comando no terminal da sua máquina (onde o código está):
   `npm install @aws-sdk/client-s3`
   (ou `pnpm add @aws-sdk/client-s3`)
3. Faça o commit e push para o GitHub.

Assim que o Railway fizer o novo deploy com as variáveis configuradas e a biblioteca instalada, o sistema de upload de comprovantes estará **100% funcional**!
