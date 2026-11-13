# Memórias da Escola Indígena

API Hono em Cloudflare Workers, dados relacionais em D1 e imagens em bucket privado do Oracle Object Storage via API S3. O painel fica em `/painel`.

## Desenvolvimento

a

1. Execute `npm install` e configure `.env` conforme `.env.example`. As chaves Oracle são Customer Secret Keys (Access Key e Secret Key), com permissão de leitura e escrita no bucket Standard.
2. Execute `npm run db:migrate:local` para criar as tabelas no D1 local.
3. Em um terminal execute `npm run dev:api` e em outro `npm run dev`. Acesse o Vite na porta 5173. `/api` é encaminhado para o Worker na porta 8787.

Imagens são enviadas à Oracle ao escolher um arquivo no editor. Sem configuração Oracle, o editor pode usar panoramas predefinidos, mas uploads retornam erro de configuração. Os uploads usam o bucket configurado mesmo no desenvolvimento. As URLs `/api/media/:id` permitem leitura pública das imagens enviadas, sem expor as credenciais nem abrir o bucket.

Clique em **Salvar e publicar** para gravar a planta no D1. Paredes, ambientes, pontos, conexões e hotspots são persistidos em tabelas relacionadas, em uma transação. O limite da planta é 1 MB sem imagens; cada upload aceita JPEG, PNG ou WebP até 20 MB. Arquivos enviados e depois descartados no editor permanecem no bucket.

## Deploy

1. `npx wrangler login`
2. `npm run db:create`: copie o ID retornado para `database_id` em `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. Configure cada variável de `.env.example` com `npx wrangler secret put NOME_DA_VARIAVEL`. O `.env` é apenas local; não é enviado como secrets de produção.
5. `npm run deploy`

O mesmo Worker serve o site e a API, evitando configuração de CORS entre o painel e o backend. As sessões HttpOnly e o limite de tentativas ficam no D1. Alterar as credenciais invalida as sessões antigas. Nunca use prefixo `VITE_` nas credenciais.

O antigo arquivo `data/tour.json` não é usado pelo Worker e permanece preservado. A importação do navegador foi removida.

## Verificação

`npm run lint` valida TypeScript e `npm run build` compila o site. `wrangler deploy --dry-run` verifica o bundle do Worker sem publicar.
