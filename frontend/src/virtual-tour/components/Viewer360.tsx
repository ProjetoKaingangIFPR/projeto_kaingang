import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Point360, ArtworkHotspot } from '../types';
import { resolvePanoramaSource, getProceduralPanorama } from '../utils/proceduralPano';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Sparkles, 
  Footprints, 
  X,
  ArrowUpRight
} from 'lucide-react';

interface Viewer360Props {
  currentPoint: Point360;
  allPoints: Point360[];
  onNavigateToPoint: (pointId: string) => void;
  onCameraHeadingChange?: (headingRad: number, fovDeg: number) => void;
  showFloorArrows?: boolean;
  onToggleFloorArrows?: () => void;
  onDeleteHotspot?: (hotspotId: string) => void;
}

// Global cached shared textures
let sharedChevronTexture: THREE.CanvasTexture | null = null;
let sharedInfoPinTexture: THREE.CanvasTexture | null = null;

function getSharedChevronTexture(): THREE.CanvasTexture {
  if (sharedChevronTexture) return sharedChevronTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Soft glowing ground aura
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  // Outer glowing cyan ring
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp white inner ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 128, 84, 0, Math.PI * 2);
  ctx.stroke();

  // Directional navigation chevron arrow (points toward top/forward)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(128, 48); // Top apex
  ctx.lineTo(184, 134); // Right wing tip
  ctx.lineTo(146, 134); // Right inner nook
  ctx.lineTo(146, 186); // Right bottom stem
  ctx.lineTo(110, 186); // Left bottom stem
  ctx.lineTo(110, 134); // Left inner nook
  ctx.lineTo(72, 134);  // Left wing tip
  ctx.closePath();
  ctx.fill();

  sharedChevronTexture = new THREE.CanvasTexture(canvas);
  sharedChevronTexture.minFilter = THREE.LinearFilter;
  return sharedChevronTexture;
}

function getSharedInfoPinTexture(): THREE.CanvasTexture {
  if (sharedInfoPinTexture) return sharedInfoPinTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Soft aura
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // Solid white circular badge
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();

  // Dark inner dot
  ctx.fillStyle = '#171717';
  ctx.beginPath();
  ctx.arc(64, 64, 26, 0, Math.PI * 2);
  ctx.fill();

  // Star / Artwork icon
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 64, 64);

  sharedInfoPinTexture = new THREE.CanvasTexture(canvas);
  sharedInfoPinTexture.minFilter = THREE.LinearFilter;
  return sharedInfoPinTexture;
}

interface TransitionState {
  active: boolean;
  startTime: number;
  duration: number;
  toTexture: THREE.Texture | null;
}

export const Viewer360: React.FC<Viewer360Props> = ({
  currentPoint,
  allPoints,
  onNavigateToPoint,
  onCameraHeadingChange,
  showFloorArrows = true,
  onToggleFloorArrows,
  onDeleteHotspot
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  // Dual spheres for smooth cross-fade
  const mainSphereRef = useRef<THREE.Mesh | null>(null);
  const fadeSphereRef = useRef<THREE.Mesh | null>(null);
  const interactiveGroupRef = useRef<THREE.Group | null>(null);

  // In-memory texture cache for instant cross-fades
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());

  // Cross-fade animation coordinator
  const transitionStateRef = useRef<TransitionState>({
    active: false,
    startTime: 0,
    duration: 650,
    toTexture: null
  });

  // Interaction & Camera Angles
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const touchDistRef = useRef<number | null>(null);
  const yawRef = useRef(currentPoint.initialYaw || 0);
  const pitchRef = useRef(0);
  const fovRef = useRef(75);
  const targetYawRef = useRef(currentPoint.initialYaw || 0);
  const targetPitchRef = useRef(0);
  const targetFovRef = useRef(75);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Component UI States
  const [activeArtwork, setActiveArtwork] = useState<ArtworkHotspot | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null);

  // Texture Loader with Cache
  const loadTextureAsync = useCallback((url: string): Promise<THREE.Texture> => {
    if (textureCacheRef.current.has(url)) {
      return Promise.resolve(textureCacheRef.current.get(url)!);
    }
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          textureCacheRef.current.set(url, tex);
          resolve(tex);
        },
        undefined,
        () => {
          const fallbackUrl = getProceduralPanorama('grand_atrium');
          loader.load(fallbackUrl, (fbTex) => {
            fbTex.colorSpace = THREE.SRGBColorSpace;
            fbTex.minFilter = THREE.LinearFilter;
            fbTex.magFilter = THREE.LinearFilter;
            fbTex.generateMipmaps = false;
            textureCacheRef.current.set(url, fbTex);
            resolve(fbTex);
          });
        }
      );
    });
  }, []);

  // Preload textures for connected viewpoints for instantaneous cross-fade
  useEffect(() => {
    if (currentPoint.connectedPointIds && currentPoint.connectedPointIds.length > 0) {
      currentPoint.connectedPointIds.forEach((targetId) => {
        const targetPt = allPoints.find((p) => p.id === targetId);
        if (targetPt) {
          const url = resolvePanoramaSource(targetPt.panoramaUrl || targetPt.id);
          loadTextureAsync(url);
        }
      });
    }
  }, [currentPoint, allPoints, loadTextureAsync]);

  // 1. Initialize Three.js Scene with Dual-Sphere Architecture
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

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

    mount.appendChild(renderer.domElement);

    // Primary 360 Base Sphere (radius 500)
    const mainGeometry = new THREE.SphereGeometry(500, 60, 40);
    mainGeometry.scale(-1, 1, 1);
    const mainMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: false,
      depthWrite: true 
    });
    const mainSphere = new THREE.Mesh(mainGeometry, mainMaterial);
    mainSphere.renderOrder = 0;
    scene.add(mainSphere);
    mainSphereRef.current = mainSphere;

    // Secondary Cross-Fade Sphere (radius 499, sits slightly inside for blending)
    const fadeGeometry = new THREE.SphereGeometry(499, 60, 40);
    fadeGeometry.scale(-1, 1, 1);
    const fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const fadeSphere = new THREE.Mesh(fadeGeometry, fadeMaterial);
    fadeSphere.renderOrder = 1;
    fadeSphere.visible = false;
    scene.add(fadeSphere);
    fadeSphereRef.current = fadeSphere;

    // Group for 3D interactive floor arrows & artwork pins
    const group = new THREE.Group();
    group.renderOrder = 10;
    scene.add(group);
    interactiveGroupRef.current = group;

    // Render loop
    let animationFrameId: number;
    let lastReportedHeading = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera orientation damping
      yawRef.current += (targetYawRef.current - yawRef.current) * 0.18;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * 0.18;
      fovRef.current += (targetFovRef.current - fovRef.current) * 0.18;

      pitchRef.current = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, pitchRef.current));
      targetPitchRef.current = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, targetPitchRef.current));

      // Handle Cross-Fade Animation
      if (transitionStateRef.current.active && fadeSphereRef.current && mainSphereRef.current) {
        const elapsed = performance.now() - transitionStateRef.current.startTime;
        const rawT = Math.min(1, elapsed / transitionStateRef.current.duration);
        // Smooth cubic in-out easing curve
        const easeT = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        const fadeMat = fadeSphereRef.current.material as THREE.MeshBasicMaterial;
        fadeMat.opacity = easeT;

        // Subtle cinematic zoom dip during cross-fade
        const zoomDip = Math.sin(rawT * Math.PI) * 2.2;
        if (cameraRef.current) {
          cameraRef.current.fov = Math.max(25, fovRef.current - zoomDip);
        }

        if (rawT >= 1) {
          // Cross-fade complete: transfer texture to main sphere and reset fade sphere
          const mainMat = mainSphereRef.current.material as THREE.MeshBasicMaterial;
          mainMat.map = transitionStateRef.current.toTexture;
          mainMat.needsUpdate = true;

          fadeSphereRef.current.visible = false;
          fadeMat.opacity = 0;
          transitionStateRef.current.active = false;
        }
      }

      if (cameraRef.current) {
        if (!transitionStateRef.current.active) {
          cameraRef.current.fov = fovRef.current;
        }
        cameraRef.current.updateProjectionMatrix();

        const x = Math.cos(pitchRef.current) * Math.sin(yawRef.current);
        const y = Math.sin(pitchRef.current);
        const z = -Math.cos(pitchRef.current) * Math.cos(yawRef.current);
        cameraRef.current.lookAt(x, y, z);
      }

      // Notify minimap of camera orientation updates
      if (onCameraHeadingChange && Math.abs(yawRef.current - lastReportedHeading) > 0.005) {
        lastReportedHeading = yawRef.current;
        onCameraHeadingChange(yawRef.current, fovRef.current);
      }

      // Gentle floating animation for floor navigation arrows
      const time = performance.now() * 0.003;
      if (interactiveGroupRef.current) {
        interactiveGroupRef.current.children.forEach((child) => {
          if (child instanceof THREE.Sprite) {
            child.lookAt(cameraRef.current!.position);
          } else if (child.userData?.type === 'navigation' && child instanceof THREE.Mesh) {
            child.position.y = -115 + Math.sin(time + (child.userData?.indexOffset || 0)) * 1.5;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mount || !cameraRef.current || !rendererRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      mainGeometry.dispose();
      mainMaterial.dispose();
      fadeGeometry.dispose();
      fadeMaterial.dispose();
    };
  }, [onCameraHeadingChange]);

  // 2. Perform Seamless 360 Cross-Fade Texture Transition
  useEffect(() => {
    if (!mainSphereRef.current || !fadeSphereRef.current) return;

    const url = resolvePanoramaSource(currentPoint.panoramaUrl || currentPoint.id);
    const isFirstLoad = !(mainSphereRef.current.material as THREE.MeshBasicMaterial).map;

    loadTextureAsync(url).then((nextTex) => {
      if (isFirstLoad) {
        // Initial first load: set directly on main sphere
        const mat = mainSphereRef.current!.material as THREE.MeshBasicMaterial;
        mat.map = nextTex;
        mat.needsUpdate = true;
      } else {
        // Subsequent navigation: start smooth cross-fade transition
        const fadeSphere = fadeSphereRef.current!;
        const fadeMat = fadeSphere.material as THREE.MeshBasicMaterial;
        fadeMat.map = nextTex;
        fadeMat.opacity = 0;
        fadeMat.needsUpdate = true;
        fadeSphere.visible = true;

        transitionStateRef.current = {
          active: true,
          startTime: performance.now(),
          duration: 650, // 650ms luxury cross-fade
          toTexture: nextTex
        };
      }
    });

    // Smoothly ease camera towards configured initial yaw
    if (currentPoint.initialYaw !== undefined) {
      targetYawRef.current = currentPoint.initialYaw;
    }
  }, [currentPoint, loadTextureAsync]);

  // 3. Rebuild 3D Interactive Floor Arrows & Artwork Pins
  useEffect(() => {
    const group = interactiveGroupRef.current;
    if (!group) return;

    // Clear previous 3D objects
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ('geometry' in obj && (obj as THREE.Mesh).geometry) {
        ((obj as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
      }
      if ('material' in obj && (obj as THREE.Mesh).material) {
        const m = (obj as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
        else (m as THREE.Material).dispose();
      }
    }

    // A. Floor Navigation Arrows pointing accurately to Connected Rooms
    if (showFloorArrows && currentPoint.connectedPointIds && currentPoint.connectedPointIds.length > 0) {
      const chevronTex = getSharedChevronTexture();

      currentPoint.connectedPointIds.forEach((targetId, idx) => {
        const targetPt = allPoints.find((p) => p.id === targetId);
        if (!targetPt) return;

        // Planar displacement in floor plan coordinates
        // In floor plan: dx is +East/-West, dy is +South/-North
        const dx = targetPt.x - currentPoint.x;
        const dy = targetPt.y - currentPoint.y;

        // In 3D spherical world coordinates:
        // yaw = 0 is North (-dy > 0), yaw = +PI/2 is East (dx > 0)
        // yaw = PI is South (-dy < 0), yaw = -PI/2 is West (dx < 0)
        const targetYaw = Math.atan2(dx, -dy);

        // Position on 3D floor (Right is +X, Forward is -Z)
        const distance = 160;
        const x = Math.sin(targetYaw) * distance;
        const z = -Math.cos(targetYaw) * distance;
        const y = -115;

        const planeGeo = new THREE.PlaneGeometry(42, 42);
        const planeMat = new THREE.MeshBasicMaterial({
          map: chevronTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        const arrowMesh = new THREE.Mesh(planeGeo, planeMat);
        arrowMesh.position.set(x, y, z);
        
        // Orient arrow to point directly towards target destination (aligned along targetYaw forward vector)
        arrowMesh.rotation.order = 'YXZ';
        arrowMesh.rotation.y = -targetYaw;
        arrowMesh.rotation.x = -Math.PI / 2 + 0.28; // Tilted slightly upwards toward camera for 3D floor perspective
        arrowMesh.rotation.z = 0;

        const targetIdx = allPoints.findIndex((p) => p.id === targetPt.id);
        const fallbackName = `Ponto ${targetIdx >= 0 ? targetIdx + 1 : 1}`;
        arrowMesh.userData = {
          type: 'navigation',
          targetId: targetPt.id,
          targetName: targetPt.name && targetPt.name.trim().length > 0 ? targetPt.name.trim() : fallbackName,
          indexOffset: idx * 1.2
        };

        group.add(arrowMesh);
      });
    }

    // B. Artwork Hotspot Pins
    if (currentPoint.hotspots && currentPoint.hotspots.length > 0) {
      const pinTex = getSharedInfoPinTexture();

      currentPoint.hotspots.forEach((spot) => {
        const yRad = spot.yaw || 0;
        const pRad = spot.pitch || 0;
        const dist = 380;

        const x = Math.cos(pRad) * Math.sin(yRad) * dist;
        const y = Math.sin(pRad) * dist;
        const z = -Math.cos(pRad) * Math.cos(yRad) * dist;

        const spriteMat = new THREE.SpriteMaterial({
          map: pinTex,
          depthWrite: false,
          transparent: true
        });

        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(x, y, z);
        sprite.scale.set(40, 40, 1);
        sprite.userData = {
          type: 'artwork',
          data: spot
        };

        group.add(sprite);
      });
    }
  }, [currentPoint, allPoints, showFloorArrows]);

  // Mouse / Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-overlay-ui')) return;
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

    // Raycast hover detection
    if (!cameraRef.current || !interactiveGroupRef.current) return;
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      interactiveGroupRef.current.children,
      true
    );

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData.type === 'navigation') {
        setHoveredLabel(`Ir para: ${hit.userData.targetName}`);
        setHoveredPos({ x: e.clientX, y: e.clientY });
        container.style.cursor = 'pointer';
        return;
      }
      if (hit.userData.type === 'artwork') {
        const spot = hit.userData.data as ArtworkHotspot;
        setHoveredLabel(spot.title);
        setHoveredPos({ x: e.clientX, y: e.clientY });
        container.style.cursor = 'pointer';
        return;
      }
    }

    container.style.cursor = 'grab';
    setHoveredLabel(null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;

    const container = containerRef.current;
    if (!container || !cameraRef.current || !interactiveGroupRef.current) return;

    const deltaMove = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y
    );

    if (deltaMove > 6) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      interactiveGroupRef.current.children,
      true
    );

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData.type === 'navigation') {
        onNavigateToPoint(hit.userData.targetId);
      } else if (hit.userData.type === 'artwork') {
        setActiveArtwork(hit.userData.data as ArtworkHotspot);
      }
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

  const handleZoomIn = () => {
    targetFovRef.current = Math.max(30, targetFovRef.current - 15);
  };

  const handleZoomOut = () => {
    targetFovRef.current = Math.min(95, targetFovRef.current + 15);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      id="tour-360-viewer"
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-neutral-950 cursor-grab active:cursor-grabbing touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Isolated Three.js WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full z-0 pointer-events-none"
      />

      {/* 3D Tooltip Hover */}
      {hoveredLabel && hoveredPos && (
        <div
          className="fixed pointer-events-none z-40 bg-neutral-900/95 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur border border-white/10 -translate-x-1/2 -translate-y-12 animate-in fade-in duration-100 flex items-center gap-1.5"
          style={{ left: hoveredPos.x, top: hoveredPos.y }}
        >
          <span>{hoveredLabel}</span>
          <ArrowUpRight className="w-3 h-3 text-sky-400" />
        </div>
      )}

      {/* Top Right: View Controls Pill */}
      <div className="interactive-overlay-ui absolute top-5 right-5 z-20 flex items-center gap-1 bg-neutral-900/85 backdrop-blur-md border border-white/10 p-1 rounded-2xl shadow-xl pointer-events-auto text-white">
        {onToggleFloorArrows && (
          <button
            id="btn-toggle-arrows"
            onClick={onToggleFloorArrows}
            title={showFloorArrows ? 'Ocultar setas de chão' : 'Exibir setas de chão'}
            className={`p-2 rounded-xl transition-colors ${
              showFloorArrows ? 'bg-white/20 text-white font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          id="btn-zoom-in"
          onClick={handleZoomIn}
          title="Aproximar zoom"
          className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          id="btn-zoom-out"
          onClick={handleZoomOut}
          title="Afastar zoom"
          className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          id="btn-fullscreen"
          onClick={handleToggleFullscreen}
          title="Tela Cheia"
          className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Artwork Curatorial Modal / Detail Drawer */}
      {activeArtwork && (
        <div
          id="artwork-detail-modal"
          className="interactive-overlay-ui fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveArtwork(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 text-neutral-900 shadow-2xl border border-neutral-200 relative animate-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono-data">
                    Acervo do Museu
                  </span>
                  <h3 className="text-base font-bold text-neutral-900">
                    {activeArtwork.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setActiveArtwork(null)}
                className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="text-xs sm:text-sm text-neutral-600 leading-relaxed bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
              {activeArtwork.description || 'Obra em exposição permanente neste ambiente do museu.'}
            </div>

            {/* Spatial Data & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              {onDeleteHotspot && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteHotspot(activeArtwork.id);
                    setActiveArtwork(null);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors font-semibold"
                >
                  Remover Marcador
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveArtwork(null)}
                className="ml-auto px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-xs"
              >
                Continuar Visita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
