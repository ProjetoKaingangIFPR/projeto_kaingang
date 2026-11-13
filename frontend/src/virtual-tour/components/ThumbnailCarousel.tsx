import React from 'react';
import { Point360 } from '../types';
import { PRESET_PANOS } from '../utils/proceduralPano';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface ThumbnailCarouselProps {
  points: Point360[];
  currentPointId: string;
  onSelectPoint: (pointId: string) => void;
}

export const ThumbnailCarousel: React.FC<ThumbnailCarouselProps> = ({
  points,
  currentPointId,
  onSelectPoint
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getThumbnailSrc = (point: Point360) => {
    if (point.thumbnailUrl) return point.thumbnailUrl;
    const preset = PRESET_PANOS.find((p) => p.id === point.panoramaUrl);
    if (preset) return preset.thumbnail;
    if (point.panoramaUrl.startsWith('data:')) return point.panoramaUrl;
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><rect width="100" height="50" fill="%2318181b"/><text x="50" y="28" fill="%23fff" font-size="10" text-anchor="middle">360°</text></svg>';
  };

  return (
    <div
      id="thumbnail-carousel-container"
      className="relative flex items-center bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-2xl px-2 py-1.5 shadow-2xl max-w-xl mx-auto"
    >
      {/* Scroll Left */}
      <button
        onClick={() => handleScroll('left')}
        aria-label="Rolar ambientes para a esquerda"
        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Thumbnails Row */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {points.map((pt) => {
          const isActive = pt.id === currentPointId;
          return (
            <button
              key={pt.id}
              onClick={() => onSelectPoint(pt.id)}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 shrink-0 text-left ${
                isActive
                  ? 'bg-sky-500/15 border-sky-400/80 shadow-md shadow-sky-500/15 ring-1 ring-sky-400/30'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <img
                src={getThumbnailSrc(pt)}
                alt={pt.name}
                className="w-11 h-8 object-cover rounded-lg border border-zinc-800 shrink-0"
              />
              <div className="max-w-[120px]">
                <div
                  className={`text-[11px] font-semibold truncate ${
                    isActive ? 'text-sky-300' : 'text-zinc-300 group-hover:text-white'
                  }`}
                >
                  {pt.name}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {pt.roomName || 'Ambiente 360°'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Scroll Right */}
      <button
        onClick={() => handleScroll('right')}
        aria-label="Rolar ambientes para a direita"
        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
