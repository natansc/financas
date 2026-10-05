This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Importação Pluggy

Como o Supabase já está configurado na Vercel, mantenha esse padrão. No projeto Vercel, abra **Settings > Environment Variables** e adicione:

```dotenv
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
```

Selecione os ambientes Vercel desejados e faça um novo deploy para aplicar as variáveis. Não é necessário duplicar as credenciais Supabase que já estão configuradas na Vercel. Para desenvolvimento local, `.env.local` contém apenas os nomes das credenciais Pluggy; as demais variáveis de infraestrutura continuam necessárias se quiser executar o app localmente.

Execute `supabase/migrations/20261001000000_pluggy_import.sql` e `supabase/migrations/20261001010000_allow_pluggy_transaction_source.sql` no SQL Editor do Supabase. A segunda migração permite registrar transações vindas da Pluggy sem alterar as origens CSV e manual. Em **Importar > Pluggy**, clique em **Nova conexão** e escolha o conector **MeuPluggy** para vincular à aplicação um banco já conectado no Meu Pluggy; autorize com a sua conta Meu Pluggy. Não escolha **Pluggy Bank** nem conectores Sandbox, que são para teste. Para conectar diretamente, escolha o próprio banco no seletor. Contas e cartões locais são criados automaticamente; quando há uma correspondência segura com um cadastro local, ele é reutilizado. Use **Importar** por conta ou **Importar todas** para sincronizar movimentações.

A importação automática de conexões existentes usa `GET /v2/items`, que precisa estar habilitado para as credenciais da aplicação Pluggy. Sem essa permissão, conexões que já existem mas ainda não foram importadas não podem ser localizadas automaticamente; solicite à Pluggy que habilite esse endpoint e então use **Importar conexões existentes**. Para uso pessoal, consulte o [guia oficial do Meu Pluggy](https://www.pluggy.ai/meu-pluggy) e o [guia de acesso à API](https://meu.pluggy.ai/api-guide). Cada novo banco conectado no Meu Pluggy precisa ser vinculado à aplicação pelo conector MeuPluggy.

Para dúvidas sobre uso pessoal, o guia indica a [comunidade do Meu Pluggy no Discord](https://discord.com/invite/EanrwJADby). O `itemId` de uma conexão pode ser importado manualmente se necessário.

Em **Período das movimentações**, selecione o mês inicial e final. Para importar todo 2025, escolha janeiro/2025 a dezembro/2025; o intervalo vale tanto para extrato bancário quanto para cartões. Débitos são salvos como despesas e créditos como receitas. O identificador original da Pluggy tem índice único no banco, então repetir a importação não duplica lançamentos. Movimentações não efetivadas e contas em moeda diferente de BRL são ignoradas. Para cartões, os lançamentos são associados ao vencimento da fatura quando esses dados estão disponíveis. O histórico importável depende do que a Pluggy disponibiliza para cada instituição/conexão.

Use os conectores Sandbox da Pluggy em desenvolvimento para validar o fluxo antes de conectar uma instituição real.

### Segurança antes de publicar

O app ainda usa `NEXT_PUBLIC_APP_TOKEN` no navegador como proteção das APIs. Como esse valor fica público no bundle, ele não protege dados financeiros em uma implantação acessível pela internet. Antes de usar conexões bancárias reais em produção, implemente autenticação de usuário e autorização no servidor; mantenha `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` somente no servidor.
