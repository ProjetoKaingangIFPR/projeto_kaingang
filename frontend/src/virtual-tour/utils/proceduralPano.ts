/**
 * High-definition procedural equirectangular 360° museum & gallery panoramas.
 * Rendered onto HTML5 canvas with realistic museum architectural details:
 * coffered ceilings, spotlight cones, artwork framed collections, marble floors,
 * neoclassical arches, and reflections.
 */

export interface PresetPano {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
}

export const PRESET_PANOS: PresetPano[] = [
  {
    id: 'grand_atrium',
    name: 'Grande Átrio & Rotunda Principal',
    category: 'Arquitetura',
    description: 'Rotunda neoclássica monumental com cúpula de vidro iluminada, colunatas de mármore e piso polido.',
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%2318181b"/><circle cx="60" cy="18" r="14" fill="%2338bdf8" opacity="0.85"/><rect x="14" y="20" width="8" height="40" fill="%23e4e4e7"/><rect x="98" y="20" width="8" height="40" fill="%23e4e4e7"/><rect y="50" width="120" height="10" fill="%2327272a"/></svg>'
  },
  {
    id: 'gallery_classic',
    name: 'Galeria Clássica de Belas Artes',
    category: 'Museu',
    description: 'Piso de parquet nobre, paredes aveludadas carmesim imperial, iluminação pontual de galeria e pinturas em molduras douradas.',
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%23271115"/><rect x="15" y="15" width="24" height="28" fill="%23d97706" stroke="%23fff" stroke-width="1"/><rect x="48" y="12" width="26" height="32" fill="%23991b1b" stroke="%23fff" stroke-width="1"/><rect x="82" y="15" width="24" height="28" fill="%23d97706" stroke="%23fff" stroke-width="1"/><rect y="48" width="120" height="12" fill="%23451a03"/></svg>'
  },
  {
    id: 'modern_pavilion',
    name: 'Pavilhão de Arte Contemporânea',
    category: 'Galeria',
    description: 'Arquitetura minimalista com concreto polido, claraboias industriais, grandes murais abstratos e esculturas modernas.',
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%2318181b"/><rect x="18" y="12" width="36" height="34" fill="%230284c7"/><rect x="66" y="14" width="38" height="30" fill="%23f97316"/><rect y="48" width="120" height="12" fill="%2327272a"/></svg>'
  },
  {
    id: 'historic_library',
    name: 'Salão Nobre da Biblioteca',
    category: 'Histórico',
    description: 'Estantes de mogno do chão ao teto, poltronas de couro capitonê, abajures clássicos e tapetes ornamentais.',
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="%231c1917"/><rect x="10" y="10" width="100" height="38" fill="%23451a03"/><line x1="10" y1="20" x2="110" y2="20" stroke="%2378350f" stroke-width="2"/><line x1="10" y1="32" x2="110" y2="32" stroke="%2378350f" stroke-width="2"/><rect y="48" width="120" height="12" fill="%23292524"/></svg>'
  },
  {
    id: 'sculpture_courtyard',
    name: 'Pátio de Esculturas & Jardim',
    category: 'Externo/Interno',
    description: 'Jardim de inverno com pedras ornamentais, esculturas em bronze e grandes panos de vidro conectando aos salões.',
    thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="35" fill="%230284c7"/><rect y="35" width="120" height="25" fill="%2315803d"/><circle cx="60" cy="38" r="10" fill="%23ca8a04"/><circle cx="28" cy="40" r="7" fill="%23166534"/><circle cx="92" cy="40" r="7" fill="%23166534"/></svg>'
  }
];

const panoCache = new Map<string, string>();

/**
 * Resolves a panorama source safely: if it's already a Data URL (uploaded image) or external HTTP/Blob URL,
 * returns it directly. Otherwise generates the requested procedural preset.
 */
export function resolvePanoramaSource(urlOrPreset?: string): string {
  if (!urlOrPreset) return getProceduralPanorama('grand_atrium');
  const clean = urlOrPreset.trim();
  if (
    clean.startsWith('data:image') ||
    clean.startsWith('data:') ||
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('blob:')
  ) {
    return clean;
  }
  return getProceduralPanorama(clean);
}

/**
 * Generates an equirectangular 2:1 ratio (2048x1024) high-definition panorama canvas data URL.
 * Memoized in-memory so each preset is drawn only once.
 */
export function getProceduralPanorama(presetId: string): string {
  if (panoCache.has(presetId)) {
    return panoCache.get(presetId)!;
  }

  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const midY = height / 2;

  switch (presetId) {
    case 'gallery_classic':
      renderClassicGallery(ctx, width, height, midY);
      break;
    case 'modern_pavilion':
      renderModernPavilion(ctx, width, height, midY);
      break;
    case 'grand_atrium':
      renderGrandAtrium(ctx, width, height, midY);
      break;
    case 'historic_library':
      renderHistoricLibrary(ctx, width, height, midY);
      break;
    default:
      renderSculptureCourtyard(ctx, width, height, midY);
      break;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  panoCache.set(presetId, dataUrl);
  return dataUrl;
}

// 1. Classical Fine Arts Gallery
function renderClassicGallery(ctx: CanvasRenderingContext2D, w: number, h: number, midY: number) {
  // Vaulted plaster ceiling with soft warm glow
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, midY * 0.7);
  ceilGrad.addColorStop(0, '#fdfbf7');
  ceilGrad.addColorStop(0.7, '#eadecc');
  ceilGrad.addColorStop(1, '#c8b69f');
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, w, midY * 0.7);

  // Ornate ceiling plaster panels
  ctx.strokeStyle = 'rgba(180, 150, 120, 0.4)';
  ctx.lineWidth = 3;
  for (let x = 0; x < w; x += 160) {
    ctx.strokeRect(x + 10, 20, 140, midY * 0.55);
  }

  // Museum Wall in royal deep velvet burgundy (#3b0d11)
  const wallGrad = ctx.createLinearGradient(0, midY * 0.65, 0, midY * 1.25);
  wallGrad.addColorStop(0, '#2d0a0d');
  wallGrad.addColorStop(0.3, '#4a1118');
  wallGrad.addColorStop(0.8, '#3b0d11');
  wallGrad.addColorStop(1, '#1e0508');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, midY * 0.65, w, midY * 0.6);

  // Classical picture rail & frieze
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, midY * 0.66, w, 6);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, midY * 0.67, w, 2);

  // Walnut dado / wainscoting skirting
  ctx.fillStyle = '#1e0c06';
  ctx.fillRect(0, midY * 1.18, w, midY * 0.08);

  // Luxurious Chevron French Parquet Floor
  const floorGrad = ctx.createLinearGradient(0, midY * 1.25, 0, h);
  floorGrad.addColorStop(0, '#78350f');
  floorGrad.addColorStop(0.4, '#53230a');
  floorGrad.addColorStop(1, '#1c0c04');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, midY * 1.25, w, h - midY * 1.25);

  // Parquet chevron boards
  ctx.strokeStyle = 'rgba(28, 12, 4, 0.35)';
  ctx.lineWidth = 1.5;
  for (let y = midY * 1.25; y < h; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Framed Masterpieces across 360 degree walls
  const paintings = [
    { x: 160, title: 'Noite Estrelada Clássica', frame: '#ca8a04', artGrad: ['#1e3a8a', '#3b82f6', '#facc15'] },
    { x: 580, title: 'Dama com Arminho', frame: '#b45309', artGrad: ['#7f1d1d', '#991b1b', '#fef08a'] },
    { x: 1000, title: 'Paisagem Pastoral Bucólica', frame: '#d97706', artGrad: ['#14532d', '#166534', '#a7f3d0'] },
    { x: 1420, title: 'A Dança das Musas', frame: '#ca8a04', artGrad: ['#581c87', '#7e22ce', '#f472b6'] },
    { x: 1840, title: 'Batalha dos Três Reinos', frame: '#b45309', artGrad: ['#7c2d12', '#9a3412', '#fed7aa'] }
  ];

  paintings.forEach((p) => {
    // Gallery ceiling warm spot illuminator
    const spot = ctx.createRadialGradient(p.x + 90, midY * 0.65, 10, p.x + 90, midY * 0.9, 140);
    spot.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    spot.addColorStop(0.7, 'rgba(254, 240, 138, 0.08)');
    spot.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(p.x + 90, midY * 0.9, 140, 0, Math.PI * 2);
    ctx.fill();

    // Heavy carved gilded gold frame
    ctx.fillStyle = p.frame;
    ctx.fillRect(p.x - 14, midY * 0.72 - 14, 208, 178);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(p.x - 8, midY * 0.72 - 8, 196, 166);
    ctx.fillStyle = p.frame;
    ctx.fillRect(p.x - 3, midY * 0.72 - 3, 186, 156);

    // Canvas artwork painting
    const grad = ctx.createLinearGradient(p.x, midY * 0.72, p.x + 180, midY * 0.72 + 150);
    grad.addColorStop(0, p.artGrad[0]);
    grad.addColorStop(0.5, p.artGrad[1]);
    grad.addColorStop(1, p.artGrad[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, midY * 0.72, 180, 150);

    // Subtle artist brushwork highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(p.x + 90, midY * 0.72 + 75, 35, 0, Math.PI * 2);
    ctx.fill();

    // Brass museum placard below
    ctx.fillStyle = '#d97706';
    ctx.fillRect(p.x + 40, midY * 0.72 + 172, 100, 14);
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOOGLE ARTS 360', p.x + 90, midY * 0.72 + 182);
  });

  // Neoclassical fluted marble columns
  const cols = [0, 420, 840, 1260, 1680, 2040];
  cols.forEach((cx) => {
    const colGrad = ctx.createLinearGradient(cx, 0, cx + 45, 0);
    colGrad.addColorStop(0, '#a1a1aa');
    colGrad.addColorStop(0.3, '#f4f4f5');
    colGrad.addColorStop(0.7, '#ffffff');
    colGrad.addColorStop(1, '#71717a');
    ctx.fillStyle = colGrad;
    ctx.fillRect(cx, midY * 0.62, 45, midY * 0.65);
  });
}

// 2. Modern Contemporary Pavilion
function renderModernPavilion(ctx: CanvasRenderingContext2D, w: number, h: number, midY: number) {
  // Deep charcoal architectural ceiling with track lights
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, w, midY * 0.6);

  // Track lighting bars
  ctx.fillStyle = '#27272a';
  ctx.fillRect(0, midY * 0.35, w, 8);
  ctx.fillRect(0, midY * 0.48, w, 8);

  for (let lx = 60; lx < w; lx += 140) {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lx, midY * 0.35 + 4, 4.5, 0, Math.PI * 2);
    ctx.arc(lx + 40, midY * 0.48 + 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Seamless warm alabaster gallery walls
  const wallGrad = ctx.createLinearGradient(0, midY * 0.6, 0, midY * 1.25);
  wallGrad.addColorStop(0, '#f4f4f5');
  wallGrad.addColorStop(0.7, '#e4e4e7');
  wallGrad.addColorStop(1, '#d4d4d8');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, midY * 0.6, w, midY * 0.65);

  // Large floor-to-ceiling panoramic glass facade
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(1350, midY * 0.6, 480, midY * 0.65);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let gx = 1350; gx <= 1830; gx += 80) {
    ctx.fillRect(gx, midY * 0.6, 4, midY * 0.65);
  }

  // Polished quartz concrete floor with soft ambient reflections
  const floorGrad = ctx.createLinearGradient(0, midY * 1.25, 0, h);
  floorGrad.addColorStop(0, '#3f3f46');
  floorGrad.addColorStop(0.4, '#27272a');
  floorGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, midY * 1.25, w, h - midY * 1.25);

  // Large modern format canvases (frameless contemporary style)
  const modernArts = [
    { x: 180, c1: '#0284c7', c2: '#0ea5e9', c3: '#f97316' },
    { x: 620, c1: '#ec4899', c2: '#8b5cf6', c3: '#6366f1' },
    { x: 1040, c1: '#10b981', c2: '#14b8a6', c3: '#f59e0b' }
  ];

  modernArts.forEach((m) => {
    // Floating shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(m.x + 8, midY * 0.72 + 8, 280, 180);

    // Canvas edge
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(m.x, midY * 0.72, 280, 180);

    const grad = ctx.createLinearGradient(m.x, midY * 0.72, m.x + 280, midY * 0.72 + 180);
    grad.addColorStop(0, m.c1);
    grad.addColorStop(0.5, m.c2);
    grad.addColorStop(1, m.c3);
    ctx.fillStyle = grad;
    ctx.fillRect(m.x + 4, midY * 0.72 + 4, 272, 172);

    // Bold minimalist geometry
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(m.x + 90, midY * 0.72 + 90, 48, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 3. Grand Atrium & Rotunda
function renderGrandAtrium(ctx: CanvasRenderingContext2D, w: number, h: number, midY: number) {
  // Skylight Dome at zenith
  const skyGrad = ctx.createLinearGradient(0, 0, 0, midY * 0.65);
  skyGrad.addColorStop(0, '#38bdf8');
  skyGrad.addColorStop(0.6, '#bae6fd');
  skyGrad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, midY * 0.65);

  // Steel geodesic dome framework
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  for (let x = 0; x < w; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, midY * 0.65);
    ctx.stroke();
  }

  // Upper gallery mezzanine balustrade
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, midY * 0.64, w, 18);
  for (let bx = 0; bx < w; bx += 24) {
    ctx.fillRect(bx, midY * 0.64, 4, 42);
  }

  // Travertine limestone ashlar walls
  const wallGrad = ctx.createLinearGradient(0, midY * 0.68, 0, midY * 1.22);
  wallGrad.addColorStop(0, '#fbf8f3');
  wallGrad.addColorStop(0.5, '#f5efe6');
  wallGrad.addColorStop(1, '#e7decb');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, midY * 0.68, w, midY * 0.54);

  // Large classical arched openings into galleries
  const arches = [220, 680, 1140, 1600];
  arches.forEach((ax) => {
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.arc(ax + 90, midY * 0.85, 80, Math.PI, 0);
    ctx.lineTo(ax + 170, midY * 1.22);
    ctx.lineTo(ax + 10, midY * 1.22);
    ctx.closePath();
    ctx.fill();

    // Arch molding
    ctx.strokeStyle = '#d4c5af';
    ctx.lineWidth = 8;
    ctx.stroke();
  });

  // High-gloss polished Carrara marble floor with quadrant inlays
  const floorGrad = ctx.createLinearGradient(0, midY * 1.22, 0, h);
  floorGrad.addColorStop(0, '#f1f5f9');
  floorGrad.addColorStop(0.3, '#cbd5e1');
  floorGrad.addColorStop(1, '#475569');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, midY * 1.22, w, h - midY * 1.22);

  // Geometric rosette marble inlay floor
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, midY * 1.45, 180, 0, Math.PI * 2);
  ctx.stroke();

  // Central bronze heroic sculpture
  ctx.fillStyle = '#334155';
  ctx.fillRect(w / 2 - 70, midY * 0.96, 140, 70); // Stone plinth
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(w / 2, midY * 0.9, 38, 0, Math.PI * 2);
  ctx.fill();
}

// 4. Historic Library Salon
function renderHistoricLibrary(ctx: CanvasRenderingContext2D, w: number, h: number, midY: number) {
  // Coffered dark walnut ceiling
  ctx.fillStyle = '#1c110a';
  ctx.fillRect(0, 0, w, midY * 0.6);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 4;
  for (let x = 0; x < w; x += 140) {
    ctx.strokeRect(x, 10, 130, midY * 0.55);
  }

  // Floor-to-ceiling mahogany bookstacks
  ctx.fillStyle = '#381608';
  ctx.fillRect(0, midY * 0.6, w, midY * 0.65);

  const bookTones = ['#b91c1c', '#1d4ed8', '#15803d', '#b45309', '#6b21a8', '#f8fafc', '#d97706'];
  for (let sy = midY * 0.62; sy < midY * 1.2; sy += 36) {
    // Shelf beam
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, sy, w, 8);

    // Rich row of books
    for (let bx = 12; bx < w - 24; bx += 13) {
      if (Math.sin(bx * 0.2 + sy) > -0.7) {
        ctx.fillStyle = bookTones[Math.abs(Math.floor(Math.sin(bx * 17) * bookTones.length))];
        const hBook = 22 + Math.floor((Math.cos(bx) + 1) * 4);
        ctx.fillRect(bx, sy - hBook, 10, hBook);
      }
    }
  }

  // Dark oak floor with oriental crimson rug
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, midY * 1.25, w, h - midY * 1.25);

  // Large Persian rug
  ctx.fillStyle = '#881337';
  ctx.fillRect(w * 0.22, midY * 1.3, w * 0.56, h * 0.25);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 4;
  ctx.strokeRect(w * 0.24, midY * 1.32, w * 0.52, h * 0.21);
}

// 5. Sculpture Courtyard & Winter Garden
function renderSculptureCourtyard(ctx: CanvasRenderingContext2D, w: number, h: number, midY: number) {
  // Clear cyan azure sky with natural light gradient
  const sky = ctx.createLinearGradient(0, 0, 0, midY * 0.7);
  sky.addColorStop(0, '#0284c7');
  sky.addColorStop(0.7, '#7dd3fc');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, midY * 0.7);

  // Fluffy clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  for (let i = 0; i < 5; i++) {
    const cx = 180 + i * 400;
    ctx.beginPath();
    ctx.arc(cx, midY * 0.35, 55, 0, Math.PI * 2);
    ctx.arc(cx + 45, midY * 0.32, 75, 0, Math.PI * 2);
    ctx.arc(cx + 90, midY * 0.35, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glass museum architecture pavilions wrapping the courtyard
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, midY * 0.6, w, midY * 0.3);
  ctx.fillStyle = '#38bdf8';
  for (let wx = 30; wx < w; wx += 70) {
    ctx.fillRect(wx, midY * 0.65, 45, midY * 0.22);
  }

  // Flagstone paving & garden lawns
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, midY * 0.9, w, h - midY * 0.9);

  // Lush manicured emerald lawns
  ctx.fillStyle = '#15803d';
  ctx.fillRect(80, midY * 1.1, 450, 130);
  ctx.fillRect(1150, midY * 1.1, 500, 130);

  // Bronze abstract monumental sculpture
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(780, midY * 1.05, 48, 0, Math.PI * 2);
  ctx.fill();
}
