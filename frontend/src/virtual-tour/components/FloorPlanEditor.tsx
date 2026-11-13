import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TourData, Wall, Point360, DrawingTool, WallPoint } from '../types';
import { PointConfigModal } from './PointConfigModal';
import { Temporary360HotspotCalibrator } from './Temporary360HotspotCalibrator';
import { 
  renderArchitecturalFloorPlan, 
  FloorPlanTheme 
} from '../utils/floorPlanRenderer';
import {
  MousePointer,
  Square,
  MapPin,
  Link2,
  Eraser,
  RotateCcw,
  Grid,
  Trash2,
  Play,
  Compass,
  Sparkles,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Focus,
  Settings,
  X,
  Star,
  Copy
} from 'lucide-react';

interface FloorPlanEditorProps {
  tourData: TourData;
  onUpdateTourData: (updated: TourData) => void;
  onLaunchTour: (startingPointId?: string) => void;
}

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  tourData,
  onUpdateTourData,
  onLaunchTour,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Editor states
  const [currentTool, setCurrentTool] = useState<DrawingTool>('select');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [orthoMode, setOrthoMode] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [wallThickness, setWallThickness] = useState<number>(8); // 8px default (matching initial walls!)
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 700
  });

  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);
  const mouseDownPosRef = useRef<{ clientX: number; clientY: number; targetPointId: string | null } | null>(null);
  const hasDraggedRef = useRef(false);

  const editorTheme: FloorPlanTheme = 'dark_blueprint';
  const isDark = true;

  // Drawing state
  const [drawingStart, setDrawingStart] = useState<WallPoint | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<WallPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<Point360 | null>(null);
  const [connectingSourcePoint, setConnectingSourcePoint] = useState<Point360 | null>(null);
  const [configModalPoint, setConfigModalPoint] = useState<Point360 | null>(null);
  const [calibratorPoint, setCalibratorPoint] = useState<Point360 | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const { floorPlan, points } = tourData;

  // Track space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressedRef.current && (e.target as HTMLElement).tagName !== 'INPUT') {
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Responsive workspace canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions({
            width: Math.floor(width),
            height: Math.floor(height)
          });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Snap coordinates to grid if enabled
  const snapCoord = useCallback(
    (val: number) => {
      if (!snapToGrid) return Math.round(val);
      return Math.round(val / gridSize) * gridSize;
    },
    [snapToGrid, gridSize]
  );

  // Convert client mouse coordinates to Floor Plan space (taking zoom & pan into account)
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): WallPoint => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const screenY = (e.clientY - rect.top) * (canvas.height / rect.height);

      const availableW = canvas.width;
      const availableH = canvas.height;
      const baseScale = Math.min(availableW / floorPlan.width, availableH / floorPlan.height) * zoom;
      const originX = (canvas.width - floorPlan.width * baseScale) / 2 + panOffset.x;
      const originY = (canvas.height - floorPlan.height * baseScale) / 2 + panOffset.y;

      const rawX = (screenX - originX) / baseScale;
      const rawY = (screenY - originY) / baseScale;

      let x = snapCoord(rawX);
      let y = snapCoord(rawY);

      if (drawingStart && (orthoMode || e.shiftKey)) {
        const dx = Math.abs(x - drawingStart.x);
        const dy = Math.abs(y - drawingStart.y);
        if (dx > dy) {
          y = drawingStart.y;
        } else {
          x = drawingStart.x;
        }
      }

      return { x, y };
    },
    [drawingStart, floorPlan.height, floorPlan.width, orthoMode, panOffset.x, panOffset.y, snapCoord, zoom]
  );

  // Find a point near mouse in world coordinates (choosing closest if multiple)
  const findPointNear = useCallback(
    (pos: WallPoint, radius = 24 / zoom): Point360 | null => {
      let closestPt: Point360 | null = null;
      let minDist = Infinity;
      for (const pt of points) {
        const dist = Math.hypot(pt.x - pos.x, pt.y - pos.y);
        if (dist <= radius && dist < minDist) {
          minDist = dist;
          closestPt = pt;
        }
      }
      return closestPt;
    },
    [points, zoom]
  );

  // Find wall near mouse in world coordinates
  const findWallNear = useCallback(
    (pos: WallPoint, radius = 14 / zoom): Wall | null => {
      for (const wall of floorPlan.walls) {
        const { start, end } = wall;
        const l2 = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
        if (l2 === 0) continue;
        let t = ((pos.x - start.x) * (end.x - start.x) + (pos.y - start.y) * (end.y - start.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = start.x + t * (end.x - start.x);
        const projY = start.y + t * (end.y - start.y);
        const dist = Math.hypot(pos.x - projX, pos.y - projY);
        if (dist <= radius) {
          return wall;
        }
      }
      return null;
    },
    [floorPlan.walls, zoom]
  );

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderArchitecturalFloorPlan({
      ctx,
      canvasWidth: canvasDimensions.width,
      canvasHeight: canvasDimensions.height,
      tourData,
      currentPointId: selectedPoint?.id,
      theme: editorTheme,
      showRadar: false,
      showLabels: true,
      showGrid: true,
      showDimensions: true,
      showConnections: true,
      showCompass: false,
      showScale: true,
      interactivePadding: 0,
      zoom,
      panOffset,
      autoFit: false,
      drawingStart,
      currentMousePos,
      drawingTool: currentTool,
      connectingSourcePoint
    });
  }, [
    canvasDimensions.width,
    canvasDimensions.height,
    tourData,
    selectedPoint?.id,
    editorTheme,
    zoom,
    panOffset,
    drawingStart,
    currentMousePos,
    currentTool,
    connectingSourcePoint
  ]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.35, Math.min(4.0, prevZoom * zoomFactor));
      return Number(nextZoom.toFixed(2));
    });
  };

  // Mouse Handlers for Editor
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Check for Panning trigger (Hand tool, Middle click, or Spacebar held)
    if (currentTool === 'pan' || e.button === 1 || isSpacePressedRef.current) {
      isPanningRef.current = true;
      hasDraggedRef.current = true;
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    if (e.button !== 0) return; // Primary left click only for drawing

    const coords = getCanvasCoords(e);
    mouseDownPosRef.current = { clientX: e.clientX, clientY: e.clientY, targetPointId: null };
    hasDraggedRef.current = false;

    if (currentTool === 'select') {
      const pt = findPointNear(coords);
      if (pt) {
        mouseDownPosRef.current.targetPointId = pt.id;
        setDraggingPointId(pt.id);
      }
      return;
    }

    if (currentTool === 'point') {
      const newPoint: Point360 = {
        id: 'p_' + Date.now().toString(36),
        name: `Sala ${points.length + 1}`,
        description: 'Galeria de exposição',
        x: coords.x,
        y: coords.y,
        panoramaUrl: 'preset_renaissance_atrium',
        initialYaw: 0,
        color: '#111111',
        connectedPointIds: [],
        hotspots: []
      };

      const updatedPoints = [...points, newPoint];
      onUpdateTourData({
        ...tourData,
        points: updatedPoints
      });
      setSelectedPoint(newPoint);
      setConfigModalPoint(newPoint);
      return;
    }

    if (currentTool === 'wall') {
      if (!drawingStart) {
        setDrawingStart(coords);
      } else {
        if (Math.hypot(coords.x - drawingStart.x, coords.y - drawingStart.y) > 5) {
          const newWall: Wall = {
            id: 'w_' + Date.now().toString(36),
            start: drawingStart,
            end: coords,
            thickness: wallThickness // Uses custom or default 8px thickness!
          };
          onUpdateTourData({
            ...tourData,
            floorPlan: {
              ...floorPlan,
              walls: [...floorPlan.walls, newWall]
            }
          });
        }
        setDrawingStart(null);
      }
      return;
    }

    if (currentTool === 'connect') {
      const pt = findPointNear(coords);
      if (!pt) return;

      if (!connectingSourcePoint) {
        setConnectingSourcePoint(pt);
      } else {
        if (connectingSourcePoint.id !== pt.id) {
          const srcId = connectingSourcePoint.id;
          const targetId = pt.id;

          const updatedPoints = points.map((p) => {
            if (p.id === srcId) {
              const currentConn = p.connectedPointIds || [];
              const nextConn = currentConn.includes(targetId)
                ? currentConn.filter((id) => id !== targetId)
                : [...currentConn, targetId];
              return { ...p, connectedPointIds: nextConn };
            }
            if (p.id === targetId) {
              const currentConn = p.connectedPointIds || [];
              const nextConn = currentConn.includes(srcId)
                ? currentConn.filter((id) => id !== srcId)
                : [...currentConn, srcId];
              return { ...p, connectedPointIds: nextConn };
            }
            return p;
          });

          onUpdateTourData({
            ...tourData,
            points: updatedPoints
          });
        }
        setConnectingSourcePoint(null);
      }
      return;
    }

    if (currentTool === 'eraser') {
      const pt = findPointNear(coords);
      if (pt) {
        const updatedPoints = points
          .filter((p) => p.id !== pt.id)
          .map((p) => ({
            ...p,
            connectedPointIds: (p.connectedPointIds || []).filter((id) => id !== pt.id)
          }));
        onUpdateTourData({
          ...tourData,
          points: updatedPoints
        });
        if (selectedPoint?.id === pt.id) setSelectedPoint(null);
        return;
      }

      const wall = findWallNear(coords);
      if (wall) {
        onUpdateTourData({
          ...tourData,
          floorPlan: {
            ...floorPlan,
            walls: floorPlan.walls.filter((w) => w.id !== wall.id)
          }
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      hasDraggedRef.current = true;
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
      return;
    }

    const coords = getCanvasCoords(e);
    setCurrentMousePos(coords);

    if (mouseDownPosRef.current) {
      const distMoved = Math.hypot(
        e.clientX - mouseDownPosRef.current.clientX,
        e.clientY - mouseDownPosRef.current.clientY
      );
      if (distMoved > 4) {
        hasDraggedRef.current = true;
      }
    }

    if (draggingPointId && currentTool === 'select') {
      const updatedPoints = points.map((p) =>
        p.id === draggingPointId ? { ...p, x: coords.x, y: coords.y } : p
      );
      onUpdateTourData({
        ...tourData,
        points: updatedPoints
      });
    }
  };

  const handleMouseUp = () => {
    const wasDrag = hasDraggedRef.current;
    const targetPtId = mouseDownPosRef.current?.targetPointId;

    isPanningRef.current = false;
    setDraggingPointId(null);
    mouseDownPosRef.current = null;
    hasDraggedRef.current = false;

    if (currentTool === 'select') {
      // Only trigger click selection if the user did NOT drag (i.e. mouse movement <= 4px)
      if (!wasDrag) {
        if (targetPtId) {
          const pt = points.find((p) => p.id === targetPtId);
          setSelectedPoint(pt || null);
        } else {
          // Clicked empty space without dragging -> close menu
          setSelectedPoint(null);
        }
      }
    }
  };

  const handleUndo = () => {
    if (floorPlan.walls.length > 0) {
      onUpdateTourData({
        ...tourData,
        floorPlan: {
          ...floorPlan,
          walls: floorPlan.walls.slice(0, -1)
        }
      });
    }
  };

  const handleClearWalls = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as paredes?')) {
      onUpdateTourData({
        ...tourData,
        floorPlan: {
          ...floorPlan,
          walls: []
        }
      });
    }
  };

  const handleAutoConnect = () => {
    const updatedPoints = points.map((p1) => {
      const conns = new Set(p1.connectedPointIds || []);
      points.forEach((p2) => {
        if (p1.id !== p2.id) {
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 260) {
            conns.add(p2.id);
          }
        }
      });
      return { ...p1, connectedPointIds: Array.from(conns) };
    });

    onUpdateTourData({
      ...tourData,
      points: updatedPoints
    });
  };

  const handleDeletePoint = (pointId: string) => {
    const target = points.find((p) => p.id === pointId);
    const pointName = target?.name || 'este ambiente';
    if (!window.confirm(`Tem certeza que deseja excluir "${pointName}"?`)) return;

    const updatedPoints = points
      .filter((p) => p.id !== pointId)
      .map((p) => ({
        ...p,
        connectedPointIds: (p.connectedPointIds || []).filter((id) => id !== pointId)
      }));

    const newStartingId =
      tourData.startingPointId === pointId
        ? updatedPoints[0]?.id || ''
        : tourData.startingPointId;

    onUpdateTourData({
      ...tourData,
      startingPointId: newStartingId,
      points: updatedPoints
    });

    if (selectedPoint?.id === pointId) {
      setSelectedPoint(null);
    }
  };

  const handleSetStartingPoint = (pointId: string) => {
    onUpdateTourData({
      ...tourData,
      startingPointId: pointId
    });
  };

  const handleDuplicatePoint = (point: Point360) => {
    const newPt: Point360 = {
      ...point,
      id: 'p_' + Date.now().toString(36),
      name: `${point.name || 'Sala'} (Cópia)`,
      x: point.x + 35,
      y: point.y + 35,
      connectedPointIds: [point.id]
    };
    const updatedPoints = [...points, newPt];
    onUpdateTourData({
      ...tourData,
      points: updatedPoints
    });
    setSelectedPoint(newPt);
  };

  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const activePoint = points.find((p) => p.id === selectedPoint?.id) || null;

  return (
    <div id="floorplan-editor-container" className="flex-1 flex flex-col w-full h-full bg-[#f3f3f4]">
      {/* Drafting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white border-b border-neutral-200 shadow-xs">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-semibold">
          <button
            id="tool-select"
            onClick={() => {
              setCurrentTool('select');
              setDrawingStart(null);
            }}
            title="Selecionar / Mover Ponto"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'select'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Mover</span>
          </button>

          <button
            id="tool-pan"
            onClick={() => {
              setCurrentTool('pan');
              setDrawingStart(null);
            }}
            title="Mover Tela / Pan (Segure Espaço ou Botão do Meio)"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'pan'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Navegar</span>
          </button>

          <button
            id="tool-wall"
            onClick={() => {
              setCurrentTool('wall');
              setDrawingStart(null);
            }}
            title="Desenhar Paredes (Clique início e fim)"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'wall'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Paredes</span>
          </button>

          <button
            id="tool-point"
            onClick={() => {
              setCurrentTool('point');
              setDrawingStart(null);
            }}
            title="Inserir Ponto 360° na Planta"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'point'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Ponto 360°</span>
          </button>

          <button
            id="tool-connect"
            onClick={() => {
              setCurrentTool('connect');
              setDrawingStart(null);
            }}
            title="Conectar Ambientes"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'connect'
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Conectar</span>
          </button>

          <button
            id="tool-eraser"
            onClick={() => {
              setCurrentTool('eraser');
              setDrawingStart(null);
            }}
            title="Apagar elemento"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              currentTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-neutral-600 hover:text-rose-600'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Apagar</span>
          </button>
        </div>

        {/* Thickness Selector when drawing walls */}
        {currentTool === 'wall' && (
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-200 text-xs">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono-data">
              Espessura:
            </span>
            <button
              onClick={() => setWallThickness(6)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                wallThickness === 6
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-200'
              }`}
              title="6px: Divisória Interna fina"
            >
              6px (Divisória)
            </button>
            <button
              onClick={() => setWallThickness(8)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                wallThickness === 8
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-200'
              }`}
              title="8px: Parede Estrutural Padrão"
            >
              8px (Padrão)
            </button>
            <button
              onClick={() => setWallThickness(12)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                wallThickness === 12
                  ? 'bg-black text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-200'
              }`}
              title="12px: Parede Perimetral / Fachada Grossa"
            >
              12px (Perímetro)
            </button>
          </div>
        )}

        {/* Board adjustments & Zoom */}
        <div className="flex items-center gap-2 text-xs">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.2).toFixed(2))))}
              title="Diminuir Zoom"
              className="p-1.5 rounded-lg text-neutral-700 hover:bg-white transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono-data text-[11px] font-bold text-neutral-700 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(4.0, Number((z + 0.2).toFixed(2))))}
              title="Aumentar Zoom"
              className="p-1.5 rounded-lg text-neutral-700 hover:bg-white transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              title="Ajustar / Resetar Visão (100%)"
              className="p-1.5 rounded-lg text-neutral-700 hover:bg-white transition-colors"
            >
              <Focus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            id="btn-toggle-grid-snap"
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Ativar/Desativar grade magnética"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition-colors ${
              snapToGrid
                ? 'bg-neutral-100 border-black text-black font-semibold'
                : 'bg-white border-neutral-200 text-neutral-500'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grade {gridSize}px</span>
          </button>

          <button
            id="btn-toggle-ortho"
            onClick={() => setOrthoMode(!orthoMode)}
            title="Travar ângulos ortogonais (90°)"
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition-colors ${
              orthoMode
                ? 'bg-neutral-100 border-black text-black font-semibold'
                : 'bg-white border-neutral-200 text-neutral-500'
            }`}
          >
            <span>Orto 90°</span>
          </button>

          <button
            id="btn-auto-connect-toolbar"
            onClick={handleAutoConnect}
            title="Conectar automaticamente ambientes próximos"
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Auto-Conectar</span>
          </button>

          <button
            id="btn-undo-wall"
            onClick={handleUndo}
            disabled={floorPlan.walls.length === 0}
            title="Desfazer parede"
            className="p-2 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-600 disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-clear-walls"
            onClick={handleClearWalls}
            title="Limpar todas as paredes"
            className="p-2 rounded-lg bg-white hover:bg-rose-50 border border-neutral-200 text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Launch Tour Action */}
        <div className="flex items-center gap-2">
          <button
            id="btn-launch-tour-from-editor"
            onClick={() => onLaunchTour()}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-black hover:bg-neutral-800 flex items-center gap-2 shadow-xs transition-all uppercase tracking-wider"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visitar em 360°</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Full Width) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden select-none">
        {/* Canvas Workspace */}
        <div
          ref={containerRef}
          className={`w-full h-full relative flex items-center justify-center overflow-hidden select-none ${
            isDark ? 'bg-neutral-950' : 'bg-[#e5e5e7]'
          }`}
        >
          <canvas
            id="editor-canvas"
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            className={`block w-full h-full select-none ${
              currentTool === 'pan'
                ? 'cursor-grab active:cursor-grabbing'
                : currentTool === 'select'
                ? 'cursor-default'
                : 'cursor-crosshair'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />

          {/* Coordinate Readout */}
          {currentMousePos && (
            <div className={`absolute top-4 pointer-events-none bg-black/85 backdrop-blur text-[11px] font-mono-data px-3 py-1.5 rounded-lg text-white border border-white/10 shadow-lg flex items-center gap-3 transition-all ${
              activePoint ? 'left-4' : 'right-4'
            }`}>
              <span>X: {(currentMousePos.x / (floorPlan.scale || 30)).toFixed(1)}m</span>
              <span>Y: {(currentMousePos.y / (floorPlan.scale || 30)).toFixed(1)}m</span>
              <span className="text-neutral-400 border-l border-neutral-700 pl-2">Zoom: {Math.round(zoom * 100)}%</span>
            </div>
          )}

          {/* Quick Guide */}
          <div className="absolute bottom-5 left-5 pointer-events-none bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs text-neutral-300 space-y-1 shadow-2xl max-w-xs hidden md:block">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider mb-1">
              Guia do Editor
            </div>
            <div>• <strong>Ponto 360°</strong>: Clique nele para abrir o menu de configuração.</div>
            <div>• <strong>Paredes</strong>: Clique no início e no fim para traçar.</div>
            <div>• <strong>Navegar</strong>: Roda do mouse amplia; segure Espaço para mover a tela.</div>
          </div>

          {/* Floating Contextual Menu for Selected 360 Point */}
          {activePoint && (
            <div
              id="selected-point-config-menu"
              className="absolute top-4 right-4 z-30 w-80 sm:w-88 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/90 rounded-2xl shadow-2xl p-4 text-white flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 text-white">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-white truncate">
                        {activePoint.name || `Ponto ${points.findIndex((p) => p.id === activePoint.id) + 1 || 1}`}
                      </h3>
                      {tourData.startingPointId === activePoint.id && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          Início
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {activePoint.description || 'Ambiente 360° configurado'}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-close-point-menu"
                  onClick={() => setSelectedPoint(null)}
                  title="Fechar menu do ponto"
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Point Metadata & Status Chips */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col">
                  <span className="text-[10px] uppercase font-mono-data text-neutral-500 font-bold">Obras / Hotspots</span>
                  <span className="text-xs font-semibold text-white mt-0.5">
                    {activePoint.hotspots?.length || 0} {activePoint.hotspots?.length === 1 ? 'obra fixada' : 'obras fixadas'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col">
                  <span className="text-[10px] uppercase font-mono-data text-neutral-500 font-bold">Conexões</span>
                  <span className="text-xs font-semibold text-white mt-0.5">
                    {activePoint.connectedPointIds?.length || 0} {activePoint.connectedPointIds?.length === 1 ? 'sala ligada' : 'salas ligadas'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Configure Modal Trigger */}
                <button
                  id="btn-point-menu-configure"
                  type="button"
                  onClick={() => setConfigModalPoint(activePoint)}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-neutral-100 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar Sala (Nome, Foto 360°)</span>
                </button>

                {/* Calibrate 360 Hotspots */}
                <button
                  id="btn-point-menu-calibrate"
                  type="button"
                  onClick={() => setCalibratorPoint(activePoint)}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-700 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Calibrar Obras de Arte (360°)</span>
                </button>

                {/* Test in 360 Viewer */}
                <button
                  id="btn-point-menu-launch"
                  type="button"
                  onClick={() => onLaunchTour(activePoint.id)}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-700 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Visitar Esta Sala em 360°</span>
                </button>

                {/* Secondary Quick Action Row */}
                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-neutral-800">
                  <button
                    id="btn-point-menu-connect"
                    type="button"
                    onClick={() => {
                      setCurrentTool('connect');
                      setConnectingSourcePoint(activePoint);
                    }}
                    title="Conectar com outra sala"
                    className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 border border-neutral-700/60 transition-colors"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Conectar</span>
                  </button>

                  {tourData.startingPointId !== activePoint.id && (
                    <button
                      id="btn-point-menu-set-start"
                      type="button"
                      onClick={() => handleSetStartingPoint(activePoint.id)}
                      title="Definir como ponto inicial da visita virtual"
                      className="py-1.5 px-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 border border-neutral-700/60 transition-colors"
                    >
                      <Star className="w-3 h-3" />
                      <span>Tornar Início</span>
                    </button>
                  )}

                  <button
                    id="btn-point-menu-duplicate"
                    type="button"
                    onClick={() => handleDuplicatePoint(activePoint)}
                    title="Duplicar este ponto"
                    className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id="btn-point-menu-delete"
                    type="button"
                    onClick={() => handleDeletePoint(activePoint.id)}
                    title="Excluir este ponto"
                    className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-rose-950/60 text-neutral-300 hover:text-rose-400 border border-neutral-700/60 hover:border-rose-800/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Point Configuration Modal */}
      {configModalPoint && (
        <PointConfigModal
          point={configModalPoint}
          allPoints={points}
          onSave={(updatedPoint) => {
            const updatedPoints = points.map((p) =>
              p.id === updatedPoint.id ? updatedPoint : p
            );
            onUpdateTourData({
              ...tourData,
              points: updatedPoints
            });
            setConfigModalPoint(null);
          }}
          onClose={() => setConfigModalPoint(null)}
        />
      )}

      {/* Temporary 360 Hotspot Calibrator */}
      {calibratorPoint && (
        <Temporary360HotspotCalibrator
          point={calibratorPoint}
          initialHotspots={calibratorPoint.hotspots || []}
          onSaveHotspots={(updatedHotspots) => {
            const updatedPoints = points.map((p) =>
              p.id === calibratorPoint.id ? { ...p, hotspots: updatedHotspots } : p
            );
            onUpdateTourData({
              ...tourData,
              points: updatedPoints
            });
            setCalibratorPoint(null);
          }}
          onClose={() => setCalibratorPoint(null)}
        />
      )}
    </div>
  );
};
