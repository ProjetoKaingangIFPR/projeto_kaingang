import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TourData, Point360 } from '../types';
import { 
  renderArchitecturalFloorPlan, 
  getFloorPlanBounds,
  FloorPlanTheme 
} from '../utils/floorPlanRenderer';
import { 
  Maximize2, 
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

interface InteractiveFloorPlanProps {
  tourData: TourData;
  currentPointId: string;
  cameraHeadingRad: number; // 0 = North, PI/2 = East
  cameraFovDeg: number;
  onSelectPoint: (pointId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const InteractiveFloorPlan: React.FC<InteractiveFloorPlanProps> = ({
  tourData,
  currentPointId,
  cameraHeadingRad,
  cameraFovDeg,
  onSelectPoint,
  isExpanded = false,
  onToggleExpand
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const theme: FloorPlanTheme = 'dark_blueprint';
  const isDark = true;
  const [hoveredPoint, setHoveredPoint] = useState<Point360 | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Zoom & Pan state for interactive minimap
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const hasMovedRef = useRef(false);

  const { floorPlan, points } = tourData;

  // Reset zoom & pan when expanded state changes
  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [isExpanded]);

  // Render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support sharp HiDPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    renderArchitecturalFloorPlan({
      ctx,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      tourData,
      currentPointId,
      cameraHeadingRad,
      cameraFovDeg,
      hoveredPointId: hoveredPoint?.id,
      theme,
      showRadar: true,
      showLabels: false,
      showGrid: true,
      showDimensions: false,
      showConnections: true,
      showCompass: false,
      showScale: false,
      interactivePadding: isExpanded ? 24 : 14,
      zoom,
      panOffset,
      autoFit: true
    });

    ctx.restore();
  }, [
    tourData,
    currentPointId,
    cameraHeadingRad,
    cameraFovDeg,
    hoveredPoint,
    theme,
    isExpanded,
    zoom,
    panOffset
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Detect Point click / hover accurately with minimum distance calculation
  const getPointAtMouse = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const padding = isExpanded ? 24 : 14;
    const bounds = getFloorPlanBounds(floorPlan, points);

    const availableW = Math.max(10, rect.width - padding * 2);
    const availableH = Math.max(10, rect.height - padding * 2);
    const fitScale = Math.min(availableW / bounds.width, availableH / bounds.height);
    const baseScale = fitScale * zoom;

    const originX = (rect.width - bounds.width * baseScale) / 2 - bounds.minX * baseScale + panOffset.x;
    const originY = (rect.height - bounds.height * baseScale) / 2 - bounds.minY * baseScale + panOffset.y;

    let closestPt: Point360 | null = null;
    let minDist = Infinity;
    // Dynamic hit radius based on zoom level to ensure precision
    const maxHitRadius = Math.max(14, Math.min(22, 18 * Math.sqrt(zoom)));

    for (const pt of points) {
      const px = originX + pt.x * baseScale;
      const py = originY + pt.y * baseScale;
      const dist = Math.hypot(mx - px, my - py);
      if (dist <= maxHitRadius && dist < minDist) {
        minDist = dist;
        closestPt = pt;
      }
    }
    return closestPt;
  }, [floorPlan, points, isExpanded, zoom, panOffset]);

  // Zoom through mouse wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;

    setZoom((prevZoom) => {
      const newZoom = Math.min(5.0, Math.max(0.6, prevZoom * factor));
      if (Math.abs(newZoom - prevZoom) < 0.001) return prevZoom;

      const bounds = getFloorPlanBounds(floorPlan, points);
      const padding = isExpanded ? 24 : 14;
      const availableW = Math.max(10, rect.width - padding * 2);
      const availableH = Math.max(10, rect.height - padding * 2);
      const fitScale = Math.min(availableW / bounds.width, availableH / bounds.height);

      const oldBaseScale = fitScale * prevZoom;
      const newBaseScale = fitScale * newZoom;

      const oldCenterX = (rect.width - bounds.width * oldBaseScale) / 2 - bounds.minX * oldBaseScale;
      const oldCenterY = (rect.height - bounds.height * oldBaseScale) / 2 - bounds.minY * oldBaseScale;

      const newCenterX = (rect.width - bounds.width * newBaseScale) / 2 - bounds.minX * newBaseScale;
      const newCenterY = (rect.height - bounds.height * newBaseScale) / 2 - bounds.minY * newBaseScale;

      // Calculate world point under cursor and project to new panOffset
      const worldX = (mx - (oldCenterX + panOffset.x)) / oldBaseScale;
      const worldY = (my - (oldCenterY + panOffset.y)) / oldBaseScale;

      const newPanX = mx - newCenterX - worldX * newBaseScale;
      const newPanY = my - newCenterY - worldY * newBaseScale;

      setPanOffset({ x: newPanX, y: newPanY });
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y
      };
      hasMovedRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        hasMovedRef.current = true;
        setPanOffset({
          x: dragStartRef.current.panX + dx,
          y: dragStartRef.current.panY + dy
        });
      }
    }

    const pt = getPointAtMouse(e.clientX, e.clientY);
    setHoveredPoint(pt);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setHoveredPoint(null);
    setMousePos(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    const pt = getPointAtMouse(e.clientX, e.clientY);
    if (pt) {
      onSelectPoint(pt.id);
    }
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div
      id="interactive-floorplan-container"
      ref={containerRef}
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl border pointer-events-auto flex flex-col ${
        isDark
          ? 'bg-neutral-950 border-neutral-800 text-white'
          : 'bg-white border-neutral-200 text-neutral-900'
      } ${
        isExpanded
          ? 'w-[440px] h-[310px] sm:w-[500px] sm:h-[350px]'
          : 'w-60 h-40 sm:w-68 sm:h-44'
      }`}
    >
      {/* Floating control buttons */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {(zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <button
            id="btn-reset-floorplan-zoom"
            onClick={handleResetZoom}
            title="Resetar Zoom (100%)"
            className="px-1.5 py-1 rounded-lg text-[10px] font-mono-data transition-colors bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 backdrop-blur-md flex items-center gap-1"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>{Math.round(zoom * 100)}%</span>
          </button>
        )}

        {onToggleExpand && (
          <button
            id="btn-toggle-floorplan-expand"
            onClick={onToggleExpand}
            title={isExpanded ? 'Reduzir minimapa' : 'Expandir minimapa'}
            className="p-1.5 rounded-lg text-xs transition-colors bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700"
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <canvas
          id="floorplan-canvas"
          ref={canvasRef}
          className={`w-full h-full block select-none ${
            isDraggingRef.current && hasMovedRef.current
              ? 'cursor-grabbing'
              : hoveredPoint
              ? 'cursor-pointer'
              : 'cursor-grab'
          }`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleResetZoom}
        />
      </div>

      {/* Point Name Tooltip */}
      {hoveredPoint && mousePos && !hasMovedRef.current && (
        <div
          className="fixed pointer-events-none z-50 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xl border backdrop-blur-md -translate-x-1/2 -translate-y-9 transition-all duration-100 whitespace-nowrap bg-neutral-950/95 text-white border-neutral-700"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          {hoveredPoint.name && hoveredPoint.name.trim().length > 0
            ? hoveredPoint.name.trim()
            : `Ponto ${(points.findIndex((p) => p.id === hoveredPoint.id) + 1) || 1}`}
        </div>
      )}
    </div>
  );
};
