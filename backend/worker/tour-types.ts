export interface WallPoint {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: WallPoint;
  end: WallPoint;
  thickness?: number;
  type?: 'wall' | 'door' | 'window';
}

export interface ArtworkHotspot {
  id: string;
  title: string;
  description: string;
  artist?: string;
  year?: string;
  imageUrl?: string;
  yaw: number; // horizontal angle in radians (-PI to PI)
  pitch: number; // vertical angle in radians (-PI/2 to PI/2)
}

export interface RoomZone {
  id: string;
  name: string;
  color: string;
  bounds: { x: number; y: number; width: number; height: number };
  floorType?: 'parquet' | 'marble' | 'concrete' | 'carpet' | 'stone' | 'garden';
  roomPointId?: string;
}

export interface Point360 {
  id: string;
  name: string;
  description?: string;
  x: number; // Floor plan X (pixels in canvas coordinates)
  y: number; // Floor plan Y
  initialYaw: number; // Initial heading angle (0 = North)
  panoramaUrl: string; // URL, data URL, or procedural preset key
  thumbnailUrl?: string;
  connectedPointIds: string[]; // IDs of viewpoints directly reachable from this one
  hotspots?: ArtworkHotspot[];
  color?: string;
  roomName?: string;
}

export interface TourData {
  id: string;
  title: string;
  description: string;
  floorPlan: {
    width: number;
    height: number;
    scale: number; // pixels per meter
    walls: Wall[];
    rooms?: RoomZone[];
  };
  points: Point360[];
  startingPointId: string;
}

export type EditorMode = 'view' | 'editor';

export type DrawingTool = 'select' | 'pan' | 'wall' | 'point' | 'connect' | 'eraser';
