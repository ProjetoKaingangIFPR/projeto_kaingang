import React, { useState } from 'react';
import { EditorMode, Point360 } from '../types';
import { 
  Compass, 
  Eye, 
  PenTool, 
  MapPin, 
  Sparkles, 
  ChevronDown, 
} from 'lucide-react';

interface HeaderProps {
  canEdit?: boolean;
  mode: EditorMode;
  onSetMode: (mode: EditorMode) => void;
  tourTitle: string;
  points: Point360[];
  currentPointId: string;
  onSelectPoint: (pointId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  canEdit = false,
  mode,
  onSetMode,
  tourTitle,
  points,
  currentPointId,
  onSelectPoint
}) => {
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const currentPoint = points.find((p) => p.id === currentPointId) || points[0];
  const totalArtworks = points.reduce((acc, p) => acc + (p.hotspots?.length || 0), 0);

  return (
    <header
      id="tour-app-header"
      className="w-full bg-[#8B0000] backdrop-blur-md border-b border-[#730000] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 select-none z-40 relative shadow-[0_4px_25px_rgba(0,0,0,0.25)]"
    >
      {/* Brand & Tour Title */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/15">
          <Compass className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white">
              {tourTitle || 'Visita Virtual 360°'}
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15 font-mono-data">
              Interativo
            </span>
          </div>
          <p className="text-xs text-white/65 hidden md:block">
            {points.length} {points.length === 1 ? 'ambiente' : 'ambientes'} • {totalArtworks} {totalArtworks === 1 ? 'obra catalogada' : 'obras catalogadas'}
          </p>
        </div>
      </div>

      {/* Center: Quick Room Selector (Dropdown) */}
      <div className="relative">
        <button
          id="btn-header-room-selector"
          onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
        >
          <MapPin className="w-3.5 h-3.5 text-white/75" />
          <span className="max-w-[120px] sm:max-w-[180px] truncate">
            {currentPoint?.name && currentPoint.name.trim().length > 0
              ? currentPoint.name.trim()
              : `Ponto ${(points.findIndex((p) => p.id === currentPointId) + 1) || 1}`}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform duration-150 ${isRoomDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isRoomDropdownOpen && (
          <div
            className="absolute top-full mt-1.5 right-0 sm:left-0 w-64 bg-white rounded-2xl p-2 shadow-2xl border border-neutral-200/90 z-50 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2.5 py-1 font-mono-data">
              Navegar para Ambiente:
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {points.map((pt) => {
                const isSelected = pt.id === currentPointId;
                return (
                  <button
                    key={pt.id}
                    onClick={() => {
                      onSelectPoint(pt.id);
                      setIsRoomDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-left transition-all ${
                      isSelected
                        ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="truncate">
                      {pt.name && pt.name.trim().length > 0 ? pt.name.trim() : `Ponto ${points.findIndex((p) => p.id === pt.id) + 1 || 1}`}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono-data ${
                      isSelected ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {pt.hotspots?.length || 0} obras
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: Mode Switcher */}
      {canEdit && <div className="flex items-center gap-2">
        {/* View / Editor Pill Switcher */}
        <div className="flex items-center bg-black/15 p-1 rounded-xl border border-white/15">
          <button
            id="btn-mode-view"
            onClick={() => onSetMode('view')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'view'
                ?                   'bg-white text-[#8B0000] shadow-xs'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visita 360°</span>
          </button>

          <button
            id="btn-mode-editor"
            onClick={() => onSetMode('editor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'editor'
                ?                   'bg-white text-[#8B0000] shadow-xs'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Editor de Planta</span>
          </button>
        </div>
      </div>}
    </header>
  );
};
