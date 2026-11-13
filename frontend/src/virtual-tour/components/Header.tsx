import React from 'react';
import { EditorMode, Point360 } from '../types';
import { 
  Compass, 
  Eye, 
  PenTool, 
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
}) => {
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
        </div>
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
