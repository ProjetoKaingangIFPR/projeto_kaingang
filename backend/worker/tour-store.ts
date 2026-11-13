import type { TourData } from './tour-types';

const SLOT = 'published';

export async function loadTour(db: D1Database): Promise<TourData | null> {
  // Um batch oferece uma visão consistente durante publicações concorrentes.
  const [tour, walls, rooms, points, connections, hotspots] = await db.batch<{ data?: string; metadata?: string; source_id?: string; target_id?: string; point_id?: string }>([
    db.prepare('SELECT metadata FROM tours WHERE slot = ?').bind(SLOT),
    db.prepare('SELECT data FROM tour_walls WHERE tour_slot = ? ORDER BY position').bind(SLOT),
    db.prepare('SELECT data FROM tour_rooms WHERE tour_slot = ? ORDER BY position').bind(SLOT),
    db.prepare('SELECT data FROM tour_points WHERE tour_slot = ? ORDER BY position').bind(SLOT),
    db.prepare('SELECT source_id, target_id FROM tour_connections WHERE tour_slot = ? ORDER BY position').bind(SLOT),
    db.prepare('SELECT point_id, data FROM tour_hotspots WHERE tour_slot = ? ORDER BY position').bind(SLOT),
  ]);
  if (!tour.results.length) return null;
  const metadata = JSON.parse(tour.results[0].metadata!);
  return {
    ...metadata,
    floorPlan: { ...metadata.floorPlan, walls: walls.results.map(r => JSON.parse(r.data!)), rooms: rooms.results.map(r => JSON.parse(r.data!)) },
    points: points.results.map(row => {
      const point = JSON.parse(row.data!);
      return { ...point, connectedPointIds: connections.results.filter(c => c.source_id === point.id).map(c => c.target_id!), hotspots: hotspots.results.filter(h => h.point_id === point.id).map(h => JSON.parse(h.data!)) };
    }),
  };
}

export async function saveTour(db: D1Database, tour: TourData) {
  const { points, floorPlan: { walls, rooms, ...floorPlan }, ...metadata } = tour;
  const statements = [
    db.prepare('DELETE FROM tours WHERE slot = ?').bind(SLOT),
    db.prepare('INSERT INTO tours (slot, metadata, updated_at) VALUES (?, ?, ?)').bind(SLOT, JSON.stringify({ ...metadata, floorPlan }), Date.now()),
  ];
  for (const [table, items] of [['tour_walls', walls], ['tour_rooms', rooms || []]] as const) {
    items.forEach((item, index) => statements.push(db.prepare(`INSERT INTO ${table} (tour_slot, id, position, data) VALUES (?, ?, ?, ?)`).bind(SLOT, item.id, index, JSON.stringify(item))));
  }
  points.forEach(({ connectedPointIds, hotspots, ...point }, index) => statements.push(db.prepare('INSERT INTO tour_points (tour_slot, id, position, data) VALUES (?, ?, ?, ?)').bind(SLOT, point.id, index, JSON.stringify(point))));
  points.forEach(point => {
    point.connectedPointIds.forEach((id, index) => statements.push(db.prepare('INSERT INTO tour_connections (tour_slot, source_id, target_id, position) VALUES (?, ?, ?, ?)').bind(SLOT, point.id, id, index)));
    point.hotspots?.forEach((hotspot, index) => statements.push(db.prepare('INSERT INTO tour_hotspots (tour_slot, point_id, id, position, data) VALUES (?, ?, ?, ?, ?)').bind(SLOT, point.id, hotspot.id, index, JSON.stringify(hotspot))));
  });
  // D1 reverte o batch inteiro se qualquer escrita falhar.
  await db.batch(statements);
}
