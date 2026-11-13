# Backend

API independente em Hono e Cloudflare Workers. Usa D1 pelo binding DB e R2 pelo binding MEDIA. Não publica o frontend.

## Desenvolvimento

Execute nesta pasta:

```bash
npm install
```

Use Node.js 22.15 ou mais recente. Copie .env.example para .env e configure ADMIN_USERNAME, ADMIN_PASSWORD (não vazia, até 1024 caracteres) e FRONTEND_ORIGIN=http://localhost:5173. Se .env já existir, preserve suas credenciais e adicione a origem. Depois:

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

- ADMIN_USERNAME: usuário para criação inicial da conta (até 120 caracteres).
- ADMIN_PASSWORD: senha inicial como Secret (não vazia, até 1024 caracteres).
- FRONTEND_ORIGIN: origem exata do site Pages, por exemplo https://projeto-kaingang.pages.dev, sem barra final.

O wrangler.jsonc já tem o ID informado do D1 e o bucket projeto-kaingang-media. Os recursos precisam existir na conta do deploy. DB e MEDIA são bindings, não variáveis de texto. Use bucket privado de classe Standard; não é necessário habilitar acesso público, CORS ou criar chaves S3. OCI_* não é mais usado.

Para banco novo, npm run db:migrate:remote cria as tabelas. Deploy não aplica migrações automaticamente.

### Atualização de um banco existente

A migração `0002_admin_accounts.sql` cria a conta administrativa no banco e substitui a tabela de sessões, encerrando todos os acessos antigos. Não altera o tour ou as imagens. Aplique-a antes de publicar o novo backend, preferencialmente em uma janela de manutenção: a versão antiga da API não funciona com a nova tabela de sessões.

Se a migração inicial já está registrada pelo Wrangler, use `npm run db:migrate:remote` para aplicar apenas as pendentes. Se o SQL inicial foi executado manualmente no Console D1, execute somente o arquivo `0002_admin_accounts.sql` pelo Console; não reaplique `0001_virtual_tour.sql` sobre tabelas existentes.

No primeiro login correto, o backend cria a conta no D1 usando as credenciais iniciais configuradas. Depois do primeiro login, remova ADMIN_USERNAME e ADMIN_PASSWORD do ambiente: os próximos logins usam exclusivamente a conta no banco. Deixar os valores antigos no ambiente não permite entrar com uma senha antiga após trocá-la.

### Autenticação

A senha é armazenada no formato PHC com Argon2id (19 MiB, duas passagens, paralelismo 1), salt aleatório de 16 bytes e resultado de 32 bytes. O módulo WASM é incluído estaticamente no bundle, compatível com Workers. Não existe cadastro público.

Após o login, um token aleatório vai para o cookie HttpOnly, SameSite=Strict e Secure em HTTPS. O banco guarda apenas o SHA-256 desse token, o usuário, uma versão aleatória de sessão e a validade de oito horas. A versão não é derivada da senha. O limite de dez verificações por IP a cada 15 minutos é reservado atomicamente antes de verificar a senha; inclui logins bem-sucedidos.

No painel, **Alterar senha** exige a senha atual e uma nova senha não vazia de até 1024 caracteres. O backend atualiza o hash, troca automaticamente a versão e apaga as sessões antigas numa transação. Todos precisam entrar novamente. As verificações da versão também impedem que um login concorrente com a senha antiga crie uma sessão válida. A troca tem um limite separado de dez tentativas por IP a cada 15 minutos.

O custo do Argon2id precisa caber no limite de CPU do Worker contratado; valide em staging antes da publicação. O runtime local não reproduz os limites de CPU da conta de produção. Não reduza o custo criptográfico para caber no plano.

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
