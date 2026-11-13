# Memórias da Escola Indígena

Dois projetos independentes, mantidos no mesmo repositório:

- [frontend](frontend/README.md): React/Vite no Cloudflare Pages.
- [backend](backend/README.md): API Hono no Cloudflare Workers, com D1 e R2.

Cada pasta tem seu próprio package.json, package-lock.json, tsconfig.json e instruções. Execute npm install dentro de cada uma. Não existe workspace, pacote compartilhado ou instalação necessária na raiz. Cada pasta pode ser copiada para um repositório separado.

O frontend usa a API por HTTP. Uma Pages Function encaminha /api/* ao Worker separado para preservar o login por cookie. Os dois deploys são independentes.

Os tipos dos dados são definidos em cada projeto; mudanças no contrato da API devem ser refletidas em ambos.

Os dados e metadados legados foram preservados localmente em `/tmp/kaingang-legado-sj4mjuay` (fora do repositório; /tmp é temporário). As configurações locais existentes estão em backend/.env, sem enviar segredos ao GitHub.
