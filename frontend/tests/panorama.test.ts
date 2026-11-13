import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePanoramaSource } from '../src/virtual-tour/utils/proceduralPano';

test('usa o endereço do upload como panorama sem gerar uma galeria padrão', () => {
  // A geração de modelos exige canvas/document; URLs de uploads devem funcionar sem eles.
  const uploaded = '/api/media/12345678-1234-1234-1234-123456789abc';
  assert.equal(resolvePanoramaSource(uploaded), uploaded);
  assert.equal(resolvePanoramaSource(`  ${uploaded}  `), uploaded);
  assert.equal(resolvePanoramaSource('/images/panorama.jpg'), '/images/panorama.jpg');
});

test('preserva imagens externas e prévias locais', () => {
  for (const source of ['https://example.com/panorama.jpg', 'blob:https://example.com/image', 'data:image/png;base64,AAAA']) {
    assert.equal(resolvePanoramaSource(source), source);
  }
});
