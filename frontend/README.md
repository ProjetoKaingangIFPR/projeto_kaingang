# Frontend

Projeto independente em React, TypeScript e Vite.

## Desenvolvimento

Execute nesta pasta:

```bash
npm install
npm run dev
```

Acesse http://localhost:5173. O proxy do Vite encaminha /api ao backend em http://127.0.0.1:8787. Inicie o backend em outro terminal. Não é necessário instalar dependências na raiz ou ter o código do backend para compilar o frontend.

## Cloudflare Pages

- Root directory: frontend (ou a raiz, se esta pasta estiver em um repositório próprio).
- Build command: npm run build.
- Build output directory: dist.
- Variável de produção API_URL: origem HTTPS do Worker, por exemplo https://projeto-kaingang.SUA-CONTA.workers.dev, sem /api.

Cadastre API_URL nas configurações do Pages e faça um novo deploy. A função em functions/api/ encaminha /api/* ao Worker preservando cookies e o cabeçalho Origin. Somente essas rotas executam a função; o site é servido como arquivos estáticos. Não cadastre senhas administrativas no Pages.

Configure no backend FRONTEND_ORIGIN com a origem exata do Pages, sem barra final. Previews com outra origem podem consultar o tour, mas não publicar alterações.

Rotas: / (site), /visitas-virtuais (tour) e /painel (administração).

## Verificação

```bash
npm run lint
npm test
npm run build
```
