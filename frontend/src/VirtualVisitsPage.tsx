import React, { useCallback, useEffect, useState } from "react";
import { Compass, ArrowLeft } from "lucide-react";
import { TourData, EditorMode } from "./virtual-tour/types";
import { DEFAULT_TOUR } from "./virtual-tour/data/defaultTour";
import { Header } from "./virtual-tour/components/Header";
import { Viewer360 } from "./virtual-tour/components/Viewer360";
import { InteractiveFloorPlan } from "./virtual-tour/components/InteractiveFloorPlan";
import { FloorPlanEditor } from "./virtual-tour/components/FloorPlanEditor";
import { api, ApiError } from "./admin/api";



export default function VirtualVisitsPage({ administrative = false, onSessionEnd }: { administrative?: boolean; onSessionEnd?: () => void }) {
  const [tourData, setTourData] = useState<TourData>(DEFAULT_TOUR);
  const [mode, setMode] = useState<EditorMode>(administrative ? "editor" : "view");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [expired, setExpired] = useState(false);
  const [currentPointId, setCurrentPointId] = useState(
    tourData.startingPointId || tourData.points[0]?.id || "p1",
  );
  const [cameraHeading, setCameraHeading] = useState(0);
  const [cameraFov, setCameraFov] = useState(75);
  const [showFloorArrows, setShowFloorArrows] = useState(true);
  const [isFloorPlanExpanded, setIsFloorPlanExpanded] = useState(false);

  const loadTour = useCallback(() => {
    setLoading(true);
    setLoadError('');
    api<{ tour: TourData | null }>('/api/tour').then(({ tour }) => {
      const data = tour || DEFAULT_TOUR;
      setTourData(data);
      setCurrentPointId(data.startingPointId);
    }).catch(() => setLoadError('Não foi possível carregar a visita virtual. Tente novamente.'))
      .finally(() => setLoading(false));
  }, [administrative]);
  useEffect(loadTour, [loadTour]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateTour = (updated: TourData) => {
    if (!administrative) return;
    // O editor permite apagar o ponto inicial; escolha outro ponto existente.
    setTourData({ ...updated, startingPointId: updated.points.some(p => p.id === updated.startingPointId) ? updated.startingPointId : updated.points[0]?.id || '' });
    setDirty(true);
    setMessage('');
  };

  const saveTour = async () => {
    setSaving(true);
    setMessage('');
    setSaveError(false);
    const snapshot = tourData;
    try {
      await api('/api/admin/tour', { method: 'PUT', body: JSON.stringify(snapshot) });
      setDirty(false);
      setExpired(false);
      setMessage('Planta salva e publicada na visita virtual.');
    } catch (error) {
      setSaveError(true);
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar a planta.');
      if (error instanceof ApiError && error.status === 401) setExpired(true);
    } finally { setSaving(false); }
  };

  const logout = async () => {
    if (saving) return;
    if (dirty && !window.confirm('Há alterações não salvas. Deseja sair e descartá-las?')) return;
    try { await api('/api/admin/logout', { method: 'POST' }); onSessionEnd?.(); }
    catch { setSaveError(true); setMessage('Não foi possível sair. Tente novamente.'); }
  };

  useEffect(() => {
    if (!tourData.points.some((point) => point.id === currentPointId)) {
      setCurrentPointId(tourData.points[0]?.id || "p1");
    }
  }, [tourData.points, currentPointId]);

  const currentPoint =
    tourData.points.find((point) => point.id === currentPointId) ||
    tourData.points[0];

  const handleCameraHeadingChange = useCallback(
    (heading: number, fov: number) => {
      setCameraHeading(heading);
      setCameraFov(fov);
    },
    [],
  );

  const handleDeleteHotspot = (hotspotId: string) => {
    if (!currentPoint) return;
    updateTour({
      ...tourData,
      points: tourData.points.map((point) =>
        point.id === currentPoint.id
          ? {
              ...point,
              hotspots: (point.hotspots || []).filter(
                (hotspot) => hotspot.id !== hotspotId,
              ),
            }
          : point,
      ),
    });
  };

  const returnToSite = () => {
    if (saving) return;
    if (dirty && !window.confirm('Há alterações não salvas. Deseja sair e descartá-las?')) return;
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="flex h-screen w-full select-none flex-col overflow-hidden bg-[#101812] text-neutral-900">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#101812] px-4 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={returnToSite}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao site
        </button>
        <div className="hidden items-center gap-2 text-xs font-semibold text-white/60 sm:flex">
          <Compass className="h-4 w-4" />
          {administrative ? 'Painel administrativo · Editor de planta' : 'Memórias da Escola Indígena'}
        </div>
        {administrative ? <button onClick={logout} className="px-3 py-2 text-sm text-white/80 hover:text-white">Sair</button> : <div className="w-24 sm:w-40" />}
      </div>

      {administrative && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1c2720] px-4 py-3 text-white">
        <div><h1 className="font-semibold text-sm">Editor de planta</h1><p role="status" className={`text-xs mt-1 ${saveError ? 'text-red-300' : 'text-white/65'}`}>{message || (dirty ? 'Alterações ainda não publicadas.' : 'Gerencie ambientes, paredes e pontos 360°.')}</p></div>
        <div className="flex flex-wrap gap-2">
          {expired && <a href="/painel" target="_blank" rel="noreferrer" className="underline text-sm">Entrar novamente em outra aba e tentar salvar</a>}
          <button onClick={saveTour} disabled={!dirty || saving || loading || Boolean(loadError)} className="rounded-lg bg-[#8B0000] hover:bg-[#a30000] px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar e publicar'}</button>
        </div>
      </div>}

      <Header
        canEdit={administrative}
        mode={mode}
        onSetMode={setMode}
        tourTitle={tourData.title}
        points={tourData.points}
        currentPointId={currentPointId}
        onSelectPoint={setCurrentPointId}
      />

      <main inert={saving} className="relative w-full flex-1 overflow-hidden bg-neutral-950">
        {loading || loadError ? <div className="flex h-full flex-col gap-4 items-center justify-center text-white/70" role="status">{loadError || 'Carregando visita virtual…'}{loadError && <button onClick={loadTour} className="underline">Tentar novamente</button>}</div> : mode === "view" ? (
          <div className="relative h-full w-full">
            {currentPoint ? (
              <Viewer360
                currentPoint={currentPoint}
                allPoints={tourData.points}
                onNavigateToPoint={setCurrentPointId}
                onCameraHeadingChange={handleCameraHeadingChange}
                showFloorArrows={showFloorArrows}
                onToggleFloorArrows={() => setShowFloorArrows((value) => !value)}
                onDeleteHotspot={administrative ? handleDeleteHotspot : undefined}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-400">
                Nenhum ponto 360 disponível.
              </div>
            )}
            <div className="pointer-events-auto absolute bottom-6 left-6 z-20">
              <InteractiveFloorPlan
                tourData={tourData}
                currentPointId={currentPointId}
                cameraHeadingRad={cameraHeading}
                cameraFovDeg={cameraFov}
                onSelectPoint={setCurrentPointId}
                isExpanded={isFloorPlanExpanded}
                onToggleExpand={() => setIsFloorPlanExpanded((value) => !value)}
              />
            </div>
          </div>
        ) : (
          <div className={`h-full ${saving ? 'pointer-events-none opacity-60' : ''}`} inert={saving}>
          <FloorPlanEditor
            tourData={tourData}
            onUpdateTourData={updateTour}
            onLaunchTour={(startingPointId) => {
              if (startingPointId) setCurrentPointId(startingPointId);
              setMode("view");
            }}
          />
          </div>
        )}
      </main>
    </div>
  );
}
