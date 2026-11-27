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

Se a migração inicial já está registrada pelo Wrangler, use `npm run db:migrate:remote` para aplicar as pendentes. Em bancos migrados manualmente pelo Console D1, aplique apenas os arquivos ainda pendentes em ordem numérica.

A migração `0003_story_files.sql` cria o catálogo de histórias e define uma cota inicial de 10 GB para o acervo. O administrador pode alterá-la em **Histórias → Ajustar cota**. A cota inclui arquivos publicados e reservas de envios incompletos. O painel permite remover ambos. Os arquivos ficam sob o prefixo `stories/` do bucket privado `MEDIA`. A cota é própria do acervo e a cobrança do R2 considera o uso da conta.

No primeiro login correto, o backend cria a conta no D1 usando as credenciais iniciais configuradas. Depois do primeiro login, remova ADMIN_USERNAME e ADMIN_PASSWORD do ambiente: os próximos logins usam exclusivamente a conta no banco. Deixar os valores antigos no ambiente não permite entrar com uma senha antiga após trocá-la.

### Autenticação

A senha é armazenada no formato PHC com Argon2id (19 MiB, duas passagens, paralelismo 1), salt aleatório de 16 bytes e resultado de 32 bytes. O módulo WASM é incluído estaticamente no bundle, compatível com Workers. Não existe cadastro público.

Após o login, um token aleatório vai para o cookie HttpOnly, SameSite=Strict e Secure em HTTPS. O banco guarda apenas o SHA-256 desse token, o usuário, uma versão aleatória de sessão e a validade de oito horas. A versão não é derivada da senha. O limite de dez verificações por IP a cada 15 minutos é reservado atomicamente antes de verificar a senha; inclui logins bem-sucedidos.

No painel, **Alterar senha** exige a senha atual e uma nova senha não vazia de até 1024 caracteres. O backend atualiza o hash, troca automaticamente a versão e apaga as sessões antigas numa transação. Todos precisam entrar novamente. As verificações da versão também impedem que um login concorrente com a senha antiga crie uma sessão válida. A troca tem um limite separado de dez tentativas por IP a cada 15 minutos.

O custo do Argon2id precisa caber no limite de CPU do Worker contratado; valide em staging antes da publicação. O runtime local não reproduz os limites de CPU da conta de produção. Não reduza o custo criptográfico para caber no plano.

Pelo terminal: npm run deploy publica somente esta API. GET /api/admin/session retorna JSON; / retorna 404. O frontend encaminha suas chamadas /api a este serviço.

## Dados

Tour e sessões ficam no D1. Imagens ficam em tours/ no R2, disponíveis por /api/media/:id. Uploads aceitam JPEG, PNG e WebP até 20 MB; vídeos ainda não estão implementados. A planta aceita até 1 MB sem imagens. Arquivos descartados no editor permanecem no bucket.

## Otimização de arquivos já enviados

Os scripts de manutenção usam os bindings remotos do R2/D1 autenticados pelo
Wrangler. Execute o inventário antes de qualquer modificação:

```bash
node scripts/optimize-stored-media.mjs inventory
node scripts/optimize-stored-media.mjs download
```

O diretório `backend/build/stored-media/`, ignorado pelo Git, guarda o inventário,
os arquivos originais com SHA-256, os candidatos e o diário das alterações.
Preserve a pasta inteira para recuperação. Arquive uma execução antes de iniciar
outro inventário; `apply` e `verify` retomam o plano existente.

Em `frontend/`, execute `node scripts/prepare-stored-media.mjs`. Esse processo
requer Brave no Windows e usa o otimizador real em um navegador sem janela. Para
candidatos menores em pelo menos 5%, verifica resolução, transparência e SSIM de
luminância. Os vídeos também precisam manter a quantidade de quadros e faixas de
áudio e a duração (tolerância de 50 ms). O limite conservador é média SSIM >= 0,98
e mínimo >= 0,975 em 5 a 15 quadros distribuídos no vídeo; fotos exigem >= 0,99.
Uma comparação amostral não garante qualidade perceptual do vídeo inteiro.

Uma segunda etapa tenta JPEG sem perdas, preservando os metadados. Instale a
ferramenta isoladamente, sem alterar as dependências da aplicação:

```bash
npm install --prefix build/stored-media/tools --no-save --package-lock=false --no-audit --no-fund jpegtran-bin@7.0.0
node scripts/prepare-lossless-images.mjs
```

Essa etapa usa o Sharp incluído na instalação atual do Wrangler para comparar
todos os pixels decodificados, EXIF, ICC, XMP, IPTC e orientação. JPEGs com
múltiplas imagens/gain maps não são reescritos. O plano prefere o candidato JPEG
sem perdas quando disponível.

```bash
node scripts/optimize-stored-media.mjs plan
node scripts/optimize-stored-media.mjs apply --limit 1
node scripts/optimize-stored-media.mjs verify --limit 1 --api-origin https://SEU-WORKER.workers.dev
node scripts/optimize-stored-media.mjs apply
node scripts/optimize-stored-media.mjs verify --api-origin https://SEU-WORKER.workers.dev
```

`plan` apenas escreve o plano local. `apply` altera produção: valida os hashes do
backup e candidato, envia uma nova chave R2 por multipart, lê os bytes enviados
para conferir o SHA-256 e troca a referência no D1 somente se a versão anterior
continuar igual. Os IDs, coleções, ordem, autor e data permanecem. Só então remove
o objeto antigo, desde que nenhuma outra linha o referencie. Falhas deixam o
original ou o backup disponíveis, e `applied.json` permite retomar a operação.
O plano e o inventário contêm as chaves e os metadados necessários para restaurar
os originais; a restauração não é automática.

Antes de substituir objetos, publique a versão do backend com ETags que mudam
quando os arquivos são substituídos. Não use ETag baseado apenas no ID nem novas
respostas `immutable` para URLs cujo conteúdo pode mudar. A verificação opcional
da API testa a primeira imagem do acervo e as imagens do tour, inclusive HTTP 304.

## Verificação

```bash
npm run lint
npm test
npm run build
```

O build verifica o bundle do Worker sem publicar. Os testes e tipos são locais deste projeto e não importam o frontend.

FRONTEND_ORIGIN aceita uma ou mais origens exatas separadas por v?rgula, sem barra final. Exemplo: `FRONTEND_ORIGIN=https://projeto-kaingang.pages.dev,https://seusite.com`. Espa?os entre as origens s?o permitidos.
