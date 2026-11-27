# Frontend

Projeto independente em React, TypeScript e Vite.

## Desenvolvimento

Execute nesta pasta:

```bash
npm install
npm run dev
```

Acesse http://localhost:5173. O proxy do Vite encaminha /api ao backend em http://127.0.0.1:8787. Inicie o backend em outro terminal. Não é necessário instalar dependências na raiz ou ter o código do backend para compilar o frontend.

## Otimização das imagens

Os envios do acervo e dos panoramas do tour tentam reduzir JPEG e PNG no navegador,
antes de reservar espaço e enviar os bytes ao R2. A resolução é mantida e o menor
candidato entre PNG e JPEG substitui o original quando economiza pelo menos 5%.
O nome recebe a extensão correspondente quando o formato muda, e o MIME/tamanho
da cópia são usados no upload e na reserva de espaço. Não há conversão para WebP.

JPEG é testado como JPEG com qualidade 0,95 e como PNG sem perdas adicionais de
compressão. PNG opaco de 8 bits também pode virar JPEG com qualidade 0,95.
Todas as operações de canvas respeitam a orientação EXIF.
Esse ajuste pode causar pequenas perdas; não é uma porcentagem de fidelidade.
O canvas incorpora a orientação aos pixels e não copia os metadados EXIF/XMP/ICC
para a cópia. Autor e data cadastrados no painel continuam associados ao arquivo.
JPEGs com indicação de múltiplas imagens/HDR no cabeçalho e imagens acima de
40 milhões de pixels não passam pelo canvas.

PNG é otimizado sem perdas, recomprimindo apenas os dados IDAT e mantendo os
demais chunks (inclusive cor, transparência, EXIF e profundidade de bits). Não há
redução de paleta nesse candidato. Qualquer pixel com alpha menor que 255 impede
a conversão do PNG para JPEG. PNG de 16 bits ou com chunks de cor estendida/ICC
também só usa o candidato PNG sem perdas. PNG animado e todos os demais formatos
(inclusive WebP, AVIF, GIF, BMP, TIFF e HEIC) usam o original. Se o navegador não
suportar a operação, houver erro ou a economia for insuficiente, o original é
enviado normalmente.

## Otimização dos vídeos

Antes do envio do acervo, os vídeos são recodificados no navegador para MP4,
mantendo a resolução e os quadros por segundo da origem. A configuração anterior
foi preservada: `QUALITY_HIGH`, com escolha automática do codec pelo Mediabunny.
Não se força um codec ou bitrate novo. A redução de tamanho não é garantida.

As faixas de áudio compatíveis com MP4 são copiadas; quando necessário, a biblioteca
as converte. Vídeos HDR e conversões que descartariam faixas são rejeitados.
O envio também é interrompido se a cópia não ficar menor que o original. Não há
medição automática de qualidade perceptual em cada envio.

Os testes de novas configurações foram interrompidos por decisão do usuário.
Nenhum vídeo já armazenado no R2 foi substituído. A otimização das imagens
permanece independente desse fluxo.

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

FRONTEND_ORIGIN aceita uma ou mais origens exatas separadas por v?rgula, sem barra final. Exemplo: `FRONTEND_ORIGIN=https://projeto-kaingang.pages.dev,https://seusite.com`. Espa?os entre as origens s?o permitidos.
