import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Point360, ArtworkHotspot } from '../types';
import { resolvePanoramaSource, getProceduralPanorama } from '../utils/proceduralPano';
import { 
  Sparkles, 
  Check, 
  X, 
  Trash2, 
  Pencil, 
  MapPin, 
  ZoomIn, 
  ZoomOut,
  ChevronRight,
  Info,
  Compass
} from 'lucide-react';

interface Temporary360HotspotCalibratorProps {
  point: Point360;
  initialHotspots: ArtworkHotspot[];
  onSaveHotspots: (updatedHotspots: ArtworkHotspot[]) => void;
  onClose: () => void;
}

// Generate high quality pin texture for the 360 view
function getCalibratorPinTexture(isPending = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Outer glow
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  if (isPending) {
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // Solid white ring
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();

  // Center disk
  ctx.fillStyle = isPending ? '#000000' : '#111111';
  ctx.beginPath();
  ctx.arc(64, 64, 26, 0, Math.PI * 2);
  ctx.fill();

  // Icon symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isPending ? '+' : '★', 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export const Temporary360HotspotCalibrator: React.FC<Temporary360HotspotCalibratorProps> = ({
  point,
  initialHotspots,
  onSaveHotspots,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);

  // Camera & Interaction states
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const yawRef = useRef(point.initialYaw || 0);
  const targetYawRef = useRef(point.initialYaw || 0);
  const pitchRef = useRef(0);
  const targetPitchRef = useRef(0);
  const fovRef = useRef(75);
  const targetFovRef = useRef(75);
  const touchDistRef = useRef<number | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  // Component state
  const [hotspotsList, setHotspotsList] = useState<ArtworkHotspot[]>(() => [...initialHotspots]);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ yaw: number; pitch: number } | null>(null);
  const [isEditorCardOpen, setIsEditorCardOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);
  const [hoveredSpot, setHoveredSpot] = useState<ArtworkHotspot | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isTrayExpanded, setIsTrayExpanded] = useState(true);

  // 1. Scene Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1500);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Panorama Sphere
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

    // Markers Group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      yawRef.current += (targetYawRef.current - yawRef.current) * 0.35;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * 0.35;
      fovRef.current += (targetFovRef.current - fovRef.current) * 0.35;

      pitchRef.current = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, pitchRef.current));
      targetPitchRef.current = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, targetPitchRef.current));

      if (cameraRef.current) {
        cameraRef.current.fov = fovRef.current;
        cameraRef.current.updateProjectionMatrix();

        const x = Math.cos(pitchRef.current) * Math.sin(yawRef.current);
        const y = Math.sin(pitchRef.current);
        const z = -Math.cos(pitchRef.current) * Math.cos(yawRef.current);
        cameraRef.current.lookAt(x, y, z);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  // 2. Texture Loading
  useEffect(() => {
    if (!sphereRef.current) return;
    const sphere = sphereRef.current;
    const textureUrl = resolvePanoramaSource(point.panoramaUrl || point.id);
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      textureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;

        if (sphere.material instanceof THREE.MeshBasicMaterial) {
          if (sphere.material.map) sphere.material.map.dispose();
          sphere.material.color.setHex(0xffffff);
          sphere.material.map = tex;
          sphere.material.needsUpdate = true;
        }
      },
      undefined,
      () => {
        const fallbackUrl = getProceduralPanorama('grand_atrium');
        textureLoader.load(fallbackUrl, (fbTex) => {
          fbTex.colorSpace = THREE.SRGBColorSpace;
          fbTex.minFilter = THREE.LinearFilter;
          fbTex.magFilter = THREE.LinearFilter;
          fbTex.generateMipmaps = false;
          if (sphere.material instanceof THREE.MeshBasicMaterial) {
            sphere.material.color.setHex(0xffffff);
            sphere.material.map = fbTex;
            sphere.material.needsUpdate = true;
          }
        });
      }
    );
  }, [point.panoramaUrl, point.id, point.name]);

  // 3. Rebuild 3D Hotspot Sprites
  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ('material' in obj && (obj as THREE.Sprite).material) {
        ((obj as THREE.Sprite).material as THREE.Material).dispose();
      }
    }

    const standardTex = getCalibratorPinTexture(false);
    const pendingTex = getCalibratorPinTexture(true);

    hotspotsList.forEach((spot) => {
      const yRad = spot.yaw || 0;
      const pRad = spot.pitch || 0;
      const dist = 360;

      const x = Math.cos(pRad) * Math.sin(yRad) * dist;
      const y = Math.sin(pRad) * dist;
      const z = -Math.cos(pRad) * Math.cos(yRad) * dist;

      const isEditingThis = editingSpotId === spot.id;
      const mat = new THREE.SpriteMaterial({
        map: isEditingThis ? pendingTex : standardTex,
        depthWrite: false,
        transparent: true
      });

      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      const scale = isEditingThis ? 44 : 36;
      sprite.scale.set(scale, scale, 1);
      sprite.userData = {
        type: 'existing_hotspot',
        spot
      };

      group.add(sprite);
    });

    if (pendingCoords && !editingSpotId) {
      const yRad = pendingCoords.yaw;
      const pRad = pendingCoords.pitch;
      const dist = 360;

      const x = Math.cos(pRad) * Math.sin(yRad) * dist;
      const y = Math.sin(pRad) * dist;
      const z = -Math.cos(pRad) * Math.cos(yRad) * dist;

      const mat = new THREE.SpriteMaterial({
        map: pendingTex,
        depthWrite: false,
        transparent: true
      });

      const pendingSprite = new THREE.Sprite(mat);
      pendingSprite.position.set(x, y, z);
      pendingSprite.scale.set(46, 46, 1);
      pendingSprite.userData = { type: 'pending_spot' };
      group.add(pendingSprite);
    }
  }, [hotspotsList, pendingCoords, editingSpotId]);

  // Convert screen coordinates to spherical Yaw & Pitch
  const getCoordinatesFromScreen = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container || !cameraRef.current) return null;

    const rect = container.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
    if (!sphereRef.current) return null;

    const intersects = raycasterRef.current.intersectObject(sphereRef.current);
    if (intersects.length > 0) {
      const p = intersects[0].point.clone().normalize();
      const pitch = Math.asin(Math.max(-1, Math.min(1, p.y)));
      const yaw = Math.atan2(p.x, -p.z);
      return { yaw, pitch };
    }
    return null;
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-ui-layer')) return;
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - prevMouseRef.current.x;
      const deltaY = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      const sensitivity = (fovRef.current / 75) * 0.0035;
      targetYawRef.current -= deltaX * sensitivity;
      targetPitchRef.current += deltaY * sensitivity;
      return;
    }

    // Raycast hover check for existing hotspots
    if (!cameraRef.current || !markersGroupRef.current) return;
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(markersGroupRef.current.children, true);

    if (intersects.length > 0 && intersects[0].object.userData.type === 'existing_hotspot') {
      const spot = intersects[0].object.userData.spot as ArtworkHotspot;
      setHoveredSpot((prev) => (prev?.id === spot.id ? prev : spot));
      setHoverPos({ x: e.clientX, y: e.clientY });
      container.style.cursor = 'pointer';
    } else {
      setHoveredSpot((prev) => (prev ? null : null));
      container.style.cursor = 'crosshair';
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;

    if ((e.target as HTMLElement).closest('.interactive-ui-layer')) return;

    const deltaDist = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y
    );

    if (deltaDist > 6) return;

    // Check if clicked on an existing hotspot
    if (cameraRef.current && markersGroupRef.current) {
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(markersGroupRef.current.children, true);

      if (intersects.length > 0 && intersects[0].object.userData.type === 'existing_hotspot') {
        const spot = intersects[0].object.userData.spot as ArtworkHotspot;
        handleStartEdit(spot);
        return;
      }
    }

    // Clicked in 360 space: Create new Hotspot at this exact Yaw/Pitch
    const coords = getCoordinatesFromScreen(e.clientX, e.clientY);
    if (coords) {
      setEditingSpotId(null);
      setPendingCoords(coords);
      setCardTitle('');
      setCardDescription('');
      setCardError(null);
      setIsEditorCardOpen(true);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * 0.05;
    targetFovRef.current = Math.max(30, Math.min(95, targetFovRef.current + delta));
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchDistRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const deltaX = e.touches[0].clientX - prevMouseRef.current.x;
      const deltaY = e.touches[0].clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const sensitivity = (fovRef.current / 75) * 0.0035;
      targetYawRef.current -= deltaX * sensitivity;
      targetPitchRef.current += deltaY * sensitivity;
    } else if (e.touches.length === 2 && touchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const pinchDelta = (touchDistRef.current - newDist) * 0.2;
      targetFovRef.current = Math.max(30, Math.min(95, targetFovRef.current + pinchDelta));
      touchDistRef.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistRef.current = null;
  };

  // Actions
  const handleStartEdit = (spot: ArtworkHotspot) => {
    setEditingSpotId(spot.id);
    setPendingCoords({ yaw: spot.yaw || 0, pitch: spot.pitch || 0 });
    setCardTitle(spot.title);
    setCardDescription(spot.description || '');
    setCardError(null);
    setIsEditorCardOpen(true);

    targetYawRef.current = spot.yaw || 0;
    targetPitchRef.current = spot.pitch || 0;
  };

  const handleCancelEditorCard = () => {
    setIsEditorCardOpen(false);
    setPendingCoords(null);
    setEditingSpotId(null);
    setCardError(null);
  };

  const handleConfirmHotspot = () => {
    if (!cardTitle.trim()) {
      setCardError('Por favor, informe o título da obra.');
      return;
    }

    if (!pendingCoords) return;

    if (editingSpotId) {
      setHotspotsList((prev) =>
        prev.map((s) =>
          s.id === editingSpotId
            ? {
                ...s,
                title: cardTitle.trim(),
                description: cardDescription.trim(),
                yaw: pendingCoords.yaw,
                pitch: pendingCoords.pitch
              }
            : s
        )
      );
    } else {
      const newSpot: ArtworkHotspot = {
        id: 'art_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        title: cardTitle.trim(),
        description: cardDescription.trim(),
        yaw: pendingCoords.yaw,
        pitch: pendingCoords.pitch
      };
      setHotspotsList((prev) => [...prev, newSpot]);
    }

    handleCancelEditorCard();
  };

  const handleDeleteHotspot = (id: string) => {
    setHotspotsList((prev) => prev.filter((s) => s.id !== id));
    if (editingSpotId === id) {
      handleCancelEditorCard();
    }
  };

  const handleSaveAndExit = () => {
    onSaveHotspots(hotspotsList);
    onClose();
  };

  const lookAtHotspot = (spot: ArtworkHotspot) => {
    targetYawRef.current = spot.yaw || 0;
    targetPitchRef.current = spot.pitch || 0;
    targetFovRef.current = 65;
  };

  return (
    <div
      id="calibrator-360-container"
      className="fixed inset-0 z-50 flex flex-col bg-black text-neutral-900 select-none overflow-hidden animate-in fade-in duration-200"
    >
      {/* 3D WebGL Canvas Layer */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="relative flex-1 w-full h-full cursor-crosshair touch-none"
      />

      {/* Top Header */}
      <div className="interactive-ui-layer absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3.5 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-800">
                Calibração 360°
              </span>
              <h2 className="text-sm font-bold text-black font-display">
                Posicionamento de Obras no Espaço
              </h2>
            </div>
            <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
              <span>Ambiente:</span>
              <strong className="text-neutral-900">{point.name || 'Galeria'}</strong>
              <span>•</span>
              <span className="text-neutral-700 font-semibold">
                {hotspotsList.length} {hotspotsList.length === 1 ? 'obra fixada' : 'obras fixadas'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:text-black bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Descartar</span>
          </button>

          <button
            id="btn-save-calibrator-hotspots"
            type="button"
            onClick={handleSaveAndExit}
            className="px-4 py-2 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-lg shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Salvar & Concluir</span>
          </button>
        </div>
      </div>

      {/* Floating Guidance Banner */}
      <div className="interactive-ui-layer pointer-events-none absolute top-18 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/90 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl shadow-xl font-medium">
        <Sparkles className="w-4 h-4 text-white shrink-0" />
        <span>Gire o ambiente 360° e <strong>clique na obra de arte</strong> para fixar o marcador</span>
      </div>

      {/* Tooltip on hovering existing hotspot */}
      {hoveredSpot && hoverPos && !isEditorCardOpen && (
        <div
          className="pointer-events-none fixed z-30 transform -translate-x-1/2 -translate-y-full mb-3 bg-black/90 text-white px-3.5 py-1.5 rounded-lg shadow-xl text-xs max-w-xs text-center"
          style={{ left: hoverPos.x, top: hoverPos.y - 12 }}
        >
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>{hoveredSpot.title}</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5">Clique para editar</p>
        </div>
      )}

      {/* Hotspot Creation / Editing Card */}
      {isEditorCardOpen && pendingCoords && (
        <div
          id="modal-calibrator-card"
          className="interactive-ui-layer absolute bottom-6 left-6 z-30 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl p-5 shadow-2xl border border-neutral-200 text-neutral-900 space-y-3.5 animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black"></span>
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                {editingSpotId ? 'Editar Obra' : 'Nova Obra Fixada'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelEditorCard}
              className="text-neutral-400 hover:text-black p-1 rounded-md hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {cardError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {cardError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-700 mb-1">
              Título da Obra <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-calibrator-title"
              type="text"
              autoFocus
              value={cardTitle}
              onChange={(e) => {
                setCardTitle(e.target.value);
                if (cardError) setCardError(null);
              }}
              placeholder="Ex: Escultura em Mármore, Afresco..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-700 mb-1">
              Descrição Curatorial <span className="text-neutral-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              id="input-calibrator-desc"
              value={cardDescription}
              onChange={(e) => setCardDescription(e.target.value)}
              placeholder="Descreva o contexto histórico, autor ou técnicas..."
              rows={3}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-black resize-none transition-colors"
            />
          </div>

          {/* Spatial Coordinates Preview */}
          <div className="flex items-center justify-between text-[11px] text-neutral-500 bg-neutral-100 rounded-lg px-3 py-1.5 font-mono-data">
            <span>Ângulo 3D:</span>
            <span className="text-neutral-900 font-bold">
              Yaw: {Math.round((pendingCoords.yaw * 180) / Math.PI)}° • Pitch: {Math.round((pendingCoords.pitch * 180) / Math.PI)}°
            </span>
          </div>

          {/* Card Actions */}
          <div className="flex items-center justify-between pt-1">
            {editingSpotId ? (
              <button
                type="button"
                onClick={() => handleDeleteHotspot(editingSpotId)}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEditorCard}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-black rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-calibrator-spot"
                type="button"
                onClick={handleConfirmHotspot}
                className="px-4 py-1.5 text-xs font-bold tracking-wider bg-black hover:bg-neutral-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 uppercase"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{editingSpotId ? 'Atualizar Obra' : 'Fixar no Espaço 360°'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hotspots Tray / Side List */}
      <div className="interactive-ui-layer absolute top-20 right-5 z-20 w-80 max-w-[calc(100vw-2.5rem)] bg-white/95 backdrop-blur-md border border-neutral-200 rounded-2xl p-4 shadow-2xl">
        <div 
          onClick={() => setIsTrayExpanded(!isTrayExpanded)}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-black" />
            <span className="text-xs font-bold text-black tracking-tight">
              Obras Fixadas ({hotspotsList.length})
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 group-hover:text-black transition-colors font-medium">
            {isTrayExpanded ? 'Recolher' : 'Expandir'}
          </span>
        </div>

        {isTrayExpanded && (
          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {hotspotsList.length > 0 ? (
              hotspotsList.map((spot) => {
                const deg = Math.round(((spot.yaw || 0) * 180) / Math.PI);
                const isSelected = editingSpotId === spot.id;

                return (
                  <div
                    key={spot.id}
                    onClick={() => lookAtHotspot(spot)}
                    className={`group/item flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-neutral-100 border-black text-black shadow-xs font-semibold'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:border-neutral-400 hover:bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0"></span>
                        <span className="font-semibold truncate">{spot.title}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono-data pl-3 block">
                        Ângulo {deg}°
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-75 group-hover/item:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(spot);
                        }}
                        title="Editar ponto"
                        className="p-1 text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHotspot(spot.id);
                        }}
                        title="Excluir ponto"
                        className="p-1 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center rounded-xl bg-neutral-50 border border-dashed border-neutral-200 text-neutral-500 text-xs">
                Nenhuma obra fixada ainda.
                <p className="text-[11px] text-neutral-400 mt-1">
                  Clique diretamente na imagem 360° para fixar um ponto nesta sala.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar (Zoom) */}
      <div className="interactive-ui-layer absolute bottom-6 right-6 z-20 flex items-center gap-1 bg-black/90 backdrop-blur-md border border-neutral-800 p-1 rounded-xl shadow-xl text-white">
        <button
          type="button"
          onClick={() => {
            targetFovRef.current = Math.max(35, targetFovRef.current - 12);
          }}
          title="Aproximar zoom"
          className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            targetFovRef.current = Math.min(100, targetFovRef.current + 12);
          }}
          title="Afastar zoom"
          className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
