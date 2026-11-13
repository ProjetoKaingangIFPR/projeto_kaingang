import { TourData, Point360, Wall, RoomZone } from '../types';

export type FloorPlanTheme = 'dark_blueprint' | 'light_architectural';

export interface FloorPlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculates the dynamic bounding box encompassing all walls and 360 points.
 * Automatically adds a safety margin so all structures fit comfortably in any viewport or minimap.
 */
export function getFloorPlanBounds(
  floorPlan: TourData['floorPlan'],
  points: Point360[]
): FloorPlanBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (floorPlan.walls && floorPlan.walls.length > 0) {
    for (const w of floorPlan.walls) {
      minX = Math.min(minX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      maxY = Math.max(maxY, w.start.y, w.end.y);
    }
  }

  if (points && points.length > 0) {
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  // Fallback to default dimensions if no elements exist
  if (!isFinite(minX) || !isFinite(maxX)) {
    minX = 0;
    maxX = floorPlan.width || 800;
  }
  if (!isFinite(minY) || !isFinite(maxY)) {
    minY = 0;
    maxY = floorPlan.height || 520;
  }

  // Ensure minimum dimensions
  const spanX = Math.max(100, maxX - minX);
  const spanY = Math.max(100, maxY - minY);

  // Generous margin around all geometry for comfortable viewing
  const marginX = Math.max(30, spanX * 0.08);
  const marginY = Math.max(30, spanY * 0.08);

  const adjustedMinX = minX - marginX;
  const adjustedMinY = minY - marginY;
  const adjustedMaxX = maxX + marginX;
  const adjustedMaxY = maxY + marginY;

  return {
    minX: adjustedMinX,
    minY: adjustedMinY,
    maxX: adjustedMaxX,
    maxY: adjustedMaxY,
    width: Math.max(150, adjustedMaxX - adjustedMinX),
    height: Math.max(150, adjustedMaxY - adjustedMinY)
  };
}

export interface RenderFloorPlanOptions {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  tourData: TourData;
  currentPointId?: string;
  cameraHeadingRad?: number;
  cameraFovDeg?: number;
  hoveredPointId?: string | null;
  selectedPointId?: string | null;
  theme?: FloorPlanTheme;
  showRadar?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  showDimensions?: boolean;
  showConnections?: boolean;
  showCompass?: boolean;
  showScale?: boolean;
  interactivePadding?: number;
  zoom?: number;
  panOffset?: { x: number; y: number };
  autoFit?: boolean;
  // Active drawing previews
  drawingStart?: { x: number; y: number } | null;
  currentMousePos?: { x: number; y: number } | null;
  drawingTool?: string;
  connectingSourcePoint?: Point360 | null;
}

/**
 * High-definition architectural floor plan rendering engine.
 * Renders authentic structural poche walls, navigation nodes, camera radar cone,
 * and seamlessly adapts to dynamic wall geometry.
 */
export function renderArchitecturalFloorPlan(opts: RenderFloorPlanOptions) {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    tourData,
    currentPointId,
    cameraHeadingRad = 0,
    cameraFovDeg = 75,
    hoveredPointId,
    selectedPointId,
    theme = 'dark_blueprint',
    showRadar = true,
    showLabels = false,
    showGrid = true,
    showDimensions = false,
    showConnections = true,
    showCompass = false,
    showScale = false,
    interactivePadding = 24,
    zoom = 1,
    panOffset = { x: 0, y: 0 },
    autoFit = true,
    drawingStart,
    currentMousePos,
    drawingTool,
    connectingSourcePoint
  } = opts;

  const { floorPlan, points } = tourData;
  const isDark = theme === 'dark_blueprint';

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. Canvas Background
  if (isDark) {
    const bgGrad = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      50,
      canvasWidth / 2,
      canvasHeight / 2,
      Math.max(canvasWidth, canvasHeight)
    );
    bgGrad.addColorStop(0, '#111318');
    bgGrad.addColorStop(1, '#090a0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = '#f8f8f6';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Compute Viewport Transforms (Dynamic Bounds Auto-Fitting)
  const bounds = autoFit
    ? getFloorPlanBounds(floorPlan, points)
    : {
        minX: 0,
        minY: 0,
        maxX: floorPlan.width,
        maxY: floorPlan.height,
        width: floorPlan.width,
        height: floorPlan.height
      };

  const availableW = Math.max(10, canvasWidth - interactivePadding * 2);
  const availableH = Math.max(10, canvasHeight - interactivePadding * 2);
  const baseScale = Math.min(availableW / bounds.width, availableH / bounds.height) * zoom;

  const originX = (canvasWidth - bounds.width * baseScale) / 2 - bounds.minX * baseScale + panOffset.x;
  const originY = (canvasHeight - bounds.height * baseScale) / 2 - bounds.minY * baseScale + panOffset.y;

  const toScreenX = (x: number) => originX + x * baseScale;
  const toScreenY = (y: number) => originY + y * baseScale;
  const toWorldDist = (px: number) => px / (floorPlan.scale || 30);

  // 3. Architectural Drafting Grid
  if (showGrid) {
    const meterPx = (floorPlan.scale || 30) * baseScale;
    const gridStep = meterPx > 25 ? meterPx : meterPx * 2;

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    const startX = originX % gridStep;
    const startY = originY % gridStep;

    ctx.beginPath();
    for (let x = startX; x < canvasWidth; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }
    for (let y = startY; y < canvasHeight; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    }
    ctx.stroke();

    // Subtle 5m major crosshair marks
    const majorStep = meterPx * 5;
    if (majorStep > 40) {
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = originX % majorStep; x < canvasWidth; x += majorStep) {
        for (let y = originY % majorStep; y < canvasHeight; y += majorStep) {
          ctx.beginPath();
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.moveTo(x, y - 4);
          ctx.lineTo(x, y + 4);
          ctx.stroke();
        }
      }
    }
  }

  // 4. Room Zones with clean styling (No intrusive square pavers or hatching)
  if (floorPlan.rooms && floorPlan.rooms.length > 0) {
    floorPlan.rooms.forEach((room) => {
      const rx = toScreenX(room.bounds.x);
      const ry = toScreenY(room.bounds.y);
      const rw = room.bounds.width * baseScale;
      const rh = room.bounds.height * baseScale;

      // Clean architectural floor wash
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      // Room Label in architectural typography
      if (showLabels && rw > 60 && rh > 40) {
        const midX = rx + rw / 2;
        const midY = ry + rh / 2;

        const areaM2 = Math.round(
          toWorldDist(room.bounds.width) * toWorldDist(room.bounds.height)
        );

        const labelText = room.name;
        const areaText = areaM2 > 0 ? `${areaM2} m²` : '';

        ctx.save();
        ctx.font = '600 11px Plus Jakarta Sans, sans-serif';
        const textW = ctx.measureText(labelText).width;
        const badgeW = Math.max(textW + 18, 70);
        const badgeH = areaText ? 30 : 20;

        ctx.fillStyle = isDark ? 'rgba(12, 14, 20, 0.78)' : 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;

        const badgeX = midX - badgeW / 2;
        const badgeY = midY - badgeH / 2;
        drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#f1f5f9' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midX, areaText ? midY - 5 : midY);

        if (areaText) {
          ctx.font = '500 9px JetBrains Mono, monospace';
          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.fillText(areaText, midX, midY + 7);
        }

        ctx.restore();
      }
    });
  }

  // 5. Navigation Network Connections
  if (showConnections) {
    const drawn = new Set<string>();
    points.forEach((pt) => {
      pt.connectedPointIds?.forEach((targetId) => {
        const key = [pt.id, targetId].sort().join('-');
        if (!drawn.has(key)) {
          drawn.add(key);
          const target = points.find((p) => p.id === targetId);
          if (target) {
            const sx = toScreenX(pt.x);
            const sy = toScreenY(pt.y);
            const ex = toScreenX(target.x);
            const ey = toScreenY(target.y);

            // Glowing pathway line
            ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      });
    });
  }

  // 6. Architectural Walls & Windows
  floorPlan.walls.forEach((wall) => {
    const sx = toScreenX(wall.start.x);
    const sy = toScreenY(wall.start.y);
    const ex = toScreenX(wall.end.x);
    const ey = toScreenY(wall.end.y);

    const thickness = Math.max(3, (wall.thickness || 8) * baseScale);

    if (wall.type === 'window') {
      renderArchitecturalWindow(ctx, sx, sy, ex, ey, thickness, isDark);
    } else {
      renderArchitecturalWall(ctx, sx, sy, ex, ey, thickness, isDark);
    }

    // Optional Dimension Label
    if (showDimensions) {
      const distPx = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      const meters = toWorldDist(distPx).toFixed(1);
      if (distPx * baseScale > 35) {
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;

        ctx.font = '600 9px JetBrains Mono, monospace';
        ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${meters}m`, midX, midY - 6);
      }
    }
  });

  // 7. Camera Radar Cone (Field of View & Heading)
  const currentPoint = points.find((p) => p.id === currentPointId) || points[0];
  if (showRadar && currentPoint) {
    const cx = toScreenX(currentPoint.x);
    const cy = toScreenY(currentPoint.y);

    const baseAngle = cameraHeadingRad - Math.PI / 2;
    const fovRad = (cameraFovDeg * Math.PI) / 180;
    const halfFov = fovRad / 2;
    const coneRadius = Math.max(50, 85 * baseScale);

    // Dynamic radar fan gradient
    const radarGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, coneRadius);
    if (isDark) {
      radarGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
      radarGrad.addColorStop(0.35, 'rgba(14, 165, 233, 0.22)');
      radarGrad.addColorStop(0.8, 'rgba(2, 132, 199, 0.08)');
      radarGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    } else {
      radarGrad.addColorStop(0, 'rgba(2, 132, 199, 0.45)');
      radarGrad.addColorStop(0.4, 'rgba(14, 165, 233, 0.18)');
      radarGrad.addColorStop(0.85, 'rgba(2, 132, 199, 0.05)');
      radarGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    }

    ctx.save();
    ctx.fillStyle = radarGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, coneRadius, baseAngle - halfFov, baseAngle + halfFov);
    ctx.closePath();
    ctx.fill();

    // Radar cone boundary rays
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.65)' : 'rgba(2, 132, 199, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(baseAngle - halfFov) * coneRadius,
      cy + Math.sin(baseAngle - halfFov) * coneRadius
    );
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(baseAngle + halfFov) * coneRadius,
      cy + Math.sin(baseAngle + halfFov) * coneRadius
    );
    ctx.stroke();
    ctx.restore();
  }

  // 8. 360 Viewpoint Nodes
  points.forEach((pt, index) => {
    const px = toScreenX(pt.x);
    const py = toScreenY(pt.y);
    const isCurrent = pt.id === currentPointId;
    const isHovered = pt.id === hoveredPointId;
    const isSelected = pt.id === selectedPointId;
    const isConnectingSrc = connectingSourcePoint?.id === pt.id;

    ctx.save();

    // Outer Glow / Ring for Current or Selected Point
    if (isCurrent || isSelected || isConnectingSrc) {
      const pulseRing = ctx.createRadialGradient(px, py, 4, px, py, 20);
      pulseRing.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
      pulseRing.addColorStop(0.6, 'rgba(56, 189, 248, 0.2)');
      pulseRing.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = pulseRing;
      ctx.beginPath();
      ctx.arc(px, py, 20, 0, Math.PI * 2);
      ctx.fill();

      // Crisp outer halo
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Node core circle
    const nodeRadius = isCurrent ? 7.5 : isHovered ? 6.5 : 5.5;
    ctx.fillStyle = isCurrent ? '#38bdf8' : isHovered ? '#ffffff' : '#f8fafc';
    ctx.beginPath();
    ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Dark outline for crisp contrast
    ctx.strokeStyle = '#090a0f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Point badge or index number (only when labels are explicitly enabled)
    if (showLabels) {
      const label = pt.name && pt.name.trim().length > 0 ? pt.name.trim() : `P${index + 1}`;
      ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
      const textW = ctx.measureText(label).width;
      const pillW = textW + 14;
      const pillH = 18;
      const pillX = px - pillW / 2;
      const pillY = py + 14;

      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = isCurrent ? '#38bdf8' : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isCurrent ? '#38bdf8' : isDark ? '#ffffff' : '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, pillY + pillH / 2);
    }

    ctx.restore();
  });

  // 9. Interactive Drawing Previews (Wall drafting line or connection rubberband)
  if (drawingTool === 'wall' && drawingStart && currentMousePos) {
    const sx = toScreenX(drawingStart.x);
    const sy = toScreenY(drawingStart.y);
    const ex = toScreenX(currentMousePos.x);
    const ey = toScreenY(currentMousePos.y);

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Temporary distance label
    const distPx = Math.hypot(currentMousePos.x - drawingStart.x, currentMousePos.y - drawingStart.y);
    const meters = toWorldDist(distPx).toFixed(1);
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${meters}m`, (sx + ex) / 2, (sy + ey) / 2 - 8);

    ctx.restore();
  }

  if (drawingTool === 'connect' && connectingSourcePoint && currentMousePos) {
    const sx = toScreenX(connectingSourcePoint.x);
    const sy = toScreenY(connectingSourcePoint.y);
    const ex = toScreenX(currentMousePos.x);
    const ey = toScreenY(currentMousePos.y);

    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 10. Compass Rose
  if (showCompass) {
    renderCompassRose(ctx, canvasWidth - 32, 32, isDark);
  }

  // 11. Metric Scale Bar
  if (showScale) {
    renderMetricScaleBar(ctx, 24, canvasHeight - 24, (floorPlan.scale || 30) * baseScale, isDark);
  }

  ctx.restore();
}

/**
 * Renders solid structural architectural poche walls.
 */
function renderArchitecturalWall(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  thickness: number,
  isDark: boolean
) {
  // Outer casing
  ctx.strokeStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Solid poche core
  if (thickness >= 5) {
    ctx.strokeStyle = isDark ? '#1e293b' : '#334155';
    ctx.lineWidth = thickness - 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

/**
 * Renders architectural window with double glass lines and sill.
 */
function renderArchitecturalWindow(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  thickness: number,
  isDark: boolean
) {
  const dx = ex - sx;
  const dy = ey - sy;
  const angle = Math.atan2(dy, dx);
  const halfT = thickness / 2;

  const nx = Math.sin(angle) * halfT;
  const ny = -Math.cos(angle) * halfT;

  // Window Sill
  ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - nx, sy - ny);
  ctx.lineTo(ex - nx, ey - ny);
  ctx.moveTo(sx + nx, sy + ny);
  ctx.lineTo(ex + nx, ey + ny);
  ctx.stroke();

  // Double Glass Panes
  ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - nx * 0.35, sy - ny * 0.35);
  ctx.lineTo(ex - nx * 0.35, ey - ny * 0.35);
  ctx.moveTo(sx + nx * 0.35, sy + ny * 0.35);
  ctx.lineTo(ex + nx * 0.35, ey + ny * 0.35);
  ctx.stroke();
}

/**
 * Renders an architectural Compass Rose at a designated coordinate.
 */
function renderCompassRose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isDark: boolean
) {
  const r = 14;

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  // North needle (red)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(x, y - r + 2);
  ctx.lineTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.closePath();
  ctx.fill();

  // South needle
  ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(x, y + r - 2);
  ctx.lineTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.closePath();
  ctx.fill();

  // "N" Label
  ctx.font = 'bold 8px JetBrains Mono, monospace';
  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', x, y - r - 2);
}

/**
 * Renders an architectural metric scale bar.
 */
function renderMetricScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixelsPerMeter: number,
  isDark: boolean
) {
  const barMeters = 5;
  const barPx = pixelsPerMeter * barMeters;
  if (barPx < 25 || barPx > 180) return;

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  // End ticks
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + 3);
  ctx.moveTo(x + barPx, y - 3);
  ctx.lineTo(x + barPx, y + 3);
  ctx.stroke();

  ctx.font = '500 8px JetBrains Mono, monospace';
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('0', x, y + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${barMeters}m`, x + barPx, y + 4);
}

/**
 * Helper to draw a rounded rectangle.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
