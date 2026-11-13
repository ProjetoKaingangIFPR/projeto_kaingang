# Memórias da Escola Indígena

API Hono em Cloudflare Workers, dados relacionais em D1 e imagens em bucket privado do Cloudflare R2. O painel fica em `/painel`.

## Desenvolvimento

1. Execute `npm install` e configure `.env` conforme `.env.example`. O R2 usa o binding `MEDIA`, sem chaves de acesso.
2. Execute `npm run db:migrate:local` para criar as tabelas no D1 local.
3. Em um terminal execute `npm run dev:api` e em outro `npm run dev`. Acesse o Vite na porta 5173. `/api` é encaminhado para o Worker na porta 8787.

Imagens são enviadas ao R2 ao escolher um arquivo no editor. O Wrangler simula D1 e R2 localmente no desenvolvimento; os uploads locais não alteram o bucket de produção. As URLs `/api/media/:id` permitem leitura pública das imagens enviadas, sem abrir o bucket.

Clique em **Salvar e publicar** para gravar a planta no D1. Paredes, ambientes, pontos, conexões e hotspots são persistidos em tabelas relacionadas, em uma transação. O limite da planta é 1 MB sem imagens; cada upload aceita JPEG, PNG ou WebP até 20 MB. Arquivos enviados e depois descartados no editor permanecem no bucket.

## Deploy

1. `npx wrangler login`
2. Use o banco D1 já criado e confira seu `database_id` em `wrangler.jsonc`. Para outra conta, crie um banco com `npm run db:create` e atualize o ID.
3. `npm run db:migrate:remote`
4. Ative o R2 na conta Cloudflare e crie um bucket **privado**, de classe **Standard**, chamado `projeto-kaingang-media`. O binding `MEDIA` já está declarado em `wrangler.jsonc`. Pelo terminal: `npx wrangler r2 bucket create projeto-kaingang-media`. Não é necessário habilitar acesso público, CORS ou gerar tokens S3.
5. Configure cada variável de `.env.example` com `npx wrangler secret put NOME_DA_VARIAVEL`. O `.env` é apenas local; não é enviado como secrets de produção.
6. `npm run deploy`

No painel, as únicas variáveis de texto necessárias são `ADMIN_USERNAME` e `ADMIN_PASSWORD` (senha como Secret). Os recursos são bindings: `DB` para D1 e `MEDIA` para R2. As antigas variáveis `OCI_*` não são mais usadas. Se as tabelas foram criadas manualmente pelo Console D1, não reaplique a migração inicial sobre elas; use as migrações desde o início em bancos novos.

O mesmo Worker serve o site e a API, evitando configuração de CORS entre o painel e o backend. As sessões HttpOnly e o limite de tentativas ficam no D1. Alterar as credenciais invalida as sessões antigas. Nunca use prefixo `VITE_` nas credenciais.

O antigo arquivo `data/tour.json` não é usado pelo Worker e permanece preservado. A importação do navegador foi removida.

## Verificação

`npm run lint` valida TypeScript e `npm run build` compila o site. `wrangler deploy --dry-run` verifica o bundle do Worker sem publicar.
