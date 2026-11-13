import { z } from 'zod';
import type { TourData } from './tour-types';

const id = z.string().min(1).max(120);
const text = z.string().max(10000);
const coordinate = z.number().finite().min(-100000).max(100000);
const xy = z.object({ x: coordinate, y: coordinate });
// Arquivos são enviados separadamente: nunca persistir Base64 ou URLs blob.
const image = z.string().max(2048).refine(value => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}, 'Use uma imagem enviada ao servidor ou uma URL HTTPS.');
const panorama = z.union([image, z.string().regex(/^[a-zA-Z0-9_]+$/).max(120)]);
const hotspot = z.object({ id, title: text, description: text, artist: text.optional(), year: text.optional(), imageUrl: image.optional(), yaw: z.number().finite(), pitch: z.number().finite() });
const point = xy.extend({ id, name: text, description: text.optional(), initialYaw: z.number().finite(), panoramaUrl: panorama, thumbnailUrl: image.optional(), connectedPointIds: z.array(id).max(200), hotspots: z.array(hotspot).max(100).optional(), color: z.string().max(80).optional(), roomName: text.optional() });
const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;

export const tourSchema: z.ZodType<TourData> = z.object({
  id, title: text, description: text, startingPointId: id,
  floorPlan: z.object({
    width: z.number().positive().max(100000), height: z.number().positive().max(100000), scale: z.number().positive().max(10000),
    walls: z.array(z.object({ id, start: xy, end: xy, thickness: z.number().positive().optional(), type: z.enum(['wall', 'door', 'window']).optional() })).max(1000).refine(unique),
    rooms: z.array(z.object({ id, name: text, color: z.string().max(80), bounds: xy.extend({ width: z.number().nonnegative(), height: z.number().nonnegative() }), floorType: z.enum(['parquet', 'marble', 'concrete', 'carpet', 'stone', 'garden']).optional(), roomPointId: id.optional() })).max(200).refine(unique).optional(),
  }),
  points: z.array(point).min(1).max(200).refine(unique),
}).superRefine((tour, ctx) => {
  const ids = new Set(tour.points.map(p => p.id));
  if (!ids.has(tour.startingPointId)) ctx.addIssue({ code: 'custom', message: 'Selecione um ponto inicial válido.' });
  for (const point of tour.points) {
    if (point.connectedPointIds.some(id => !ids.has(id) || id === point.id) || new Set(point.connectedPointIds).size !== point.connectedPointIds.length) ctx.addIssue({ code: 'custom', message: 'A planta contém conexões inválidas.' });
    if (!unique(point.hotspots || [])) ctx.addIssue({ code: 'custom', message: 'Há pontos de interesse duplicados.' });
  }
});
