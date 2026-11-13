# Backend

API independente em Hono e Cloudflare Workers. Usa D1 pelo binding DB e R2 pelo binding MEDIA. Não publica o frontend.

## Desenvolvimento

Execute nesta pasta:

```bash
npm install
```

Copie .env.example para .env e configure ADMIN_USERNAME, ADMIN_PASSWORD e FRONTEND_ORIGIN=http://localhost:5173. Se .env já existir, preserve suas credenciais e adicione a origem. Depois:

```bash
npm run db:migrate:local
npm run dev
```

A API atende na porta 8787. D1 e R2 são simulados localmente, sem alterar produção.

## Cloudflare Workers

- Root directory: backend (ou a raiz, se esta pasta estiver em um repositório próprio).
- Build command: vazio.
- Deploy command: npx wrangler deploy.

Em Settings → Variables and Secrets, configure:

- ADMIN_USERNAME: usuário do painel.
- ADMIN_PASSWORD: senha como Secret.
- FRONTEND_ORIGIN: origem exata do site Pages, por exemplo https://projeto-kaingang.pages.dev, sem barra final.

O wrangler.jsonc já tem o ID informado do D1 e o bucket projeto-kaingang-media. Os recursos precisam existir na conta do deploy. DB e MEDIA são bindings, não variáveis de texto. Use bucket privado de classe Standard; não é necessário habilitar acesso público, CORS ou criar chaves S3. OCI_* não é mais usado.

Para banco novo, npm run db:migrate:remote cria as tabelas. Se já executou o SQL inicial pelo Console D1, não reaplique essa migração sobre as mesmas tabelas. Deploy não aplica migrações automaticamente.

Pelo terminal: npm run deploy publica somente esta API. GET /api/admin/session retorna JSON; / retorna 404. O frontend encaminha suas chamadas /api a este serviço.

## Dados

Tour e sessões ficam no D1. Imagens ficam em tours/ no R2, disponíveis por /api/media/:id. Uploads aceitam JPEG, PNG e WebP até 20 MB; vídeos ainda não estão implementados. A planta aceita até 1 MB sem imagens. Arquivos descartados no editor permanecem no bucket.

## Verificação

```bash
npm run lint
npm test
npm run build
```

O build verifica o bundle do Worker sem publicar. Os testes e tipos são locais deste projeto e não importam o frontend.
