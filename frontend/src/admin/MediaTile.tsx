import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Film, Image as ImageIcon, Play, Music2 } from 'lucide-react';
import type { StoryFile } from '../components/sections/StoryGallery';

export type MediaFile = File | StoryFile;

export function galleryImageUrl(file: StoryFile) {
  const url = '/api/stories/' + file.id + '/media';
  return file.type === 'image/jpeg' && file.size > 128 * 1024 ? url + '?preview=1' : url;
}

export function useMediaUrl(file: MediaFile) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!(file instanceof File)) return;
    const local = URL.createObjectURL(file);
    setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [file]);
  return file instanceof File ? url : '/api/stories/' + file.id + '/media';
}

export function MediaTile({ file, size, onOpen, onRemove, onOptimize, optimized, selected, onSelect, children }: {
  children?: ReactNode;
  file: MediaFile; size: string; onOpen: () => void; onRemove?: () => void; onOptimize?: () => void; optimized?: boolean; selected?: boolean; onSelect?: (checked: boolean) => void;
}) {
  const url = useMediaUrl(file);
  const [failed, setFailed] = useState(false);
  const tile = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = tile.current;
    if (!element || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const video = file.type.startsWith('video/');
  const ready = file instanceof File || file.status === 'ready';
  return <li ref={tile} className={'min-w-0 rounded-lg p-1 transition-colors ' + (selected ? 'bg-rose-950 ring-2 ring-rose-400' : '')}>
    <button type="button" disabled={!ready && !onSelect} aria-label={(onSelect ? 'Selecionar ' : 'Visualizar ') + file.name}
      aria-pressed={onSelect ? Boolean(selected) : undefined} onClick={() => onSelect ? onSelect(!selected) : onOpen()}
      className="group/tile relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-md bg-[#342d2c] outline-offset-2 enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-rose-300">
      {file.type.startsWith('audio/') ? <Music2 size={32} aria-hidden="true"/> : visible && ready && url && !failed
        ? video
          ? <video muted playsInline preload="metadata" src={url + '#t=0.1'} onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
          : <img decoding="async" alt="" src={file instanceof File ? url : galleryImageUrl(file)} onError={event => {
              if (event.currentTarget.src.endsWith('?preview=1')) event.currentTarget.src = url;
              else setFailed(true);
            }} className="absolute inset-0 size-full object-cover" />
        : video ? <Film size={28}/> : <ImageIcon size={28}/>}
      {video && ready && <span className="absolute bottom-2 left-2 grid size-8 place-items-center rounded-full bg-black/70 text-white"><Play size={15} fill="currentColor"/></span>}
      {onSelect && <span aria-hidden="true" className={'absolute right-2 top-2 grid size-8 place-items-center rounded-full border-2 shadow ' + (selected ? 'border-rose-400 bg-rose-500 text-white' : 'border-white bg-black/50')}>
        {selected && <Check size={20}/>}
      </span>}
    </button>
    <button type="button" disabled={!ready && !onSelect} onClick={() => onSelect ? onSelect(!selected) : onOpen()}
      className="mt-2 block w-full truncate text-left text-sm font-medium transition-colors enabled:hover:text-rose-200 enabled:hover:underline" title={file.name}>{file.name}</button>
    <div className="flex flex-wrap items-center justify-between gap-1 text-sm text-stone-300">
      <span>{ready ? size : 'Envio pendente'}</span>
      {onRemove && <button type="button" aria-label={(file instanceof File ? 'Retirar ' : 'Remover ') + file.name}
        className="cursor-pointer underline decoration-stone-600 underline-offset-4 hover:text-rose-200" onClick={onRemove}>{file instanceof File ? 'Retirar' : 'Remover'}</button>}
    </div>
    {onOptimize && <div className="mt-3 border-t border-white/10 pt-3">
      {optimized && <p className="mb-2 inline-flex items-center gap-1 text-sm text-green-200"><Check size={14}/> Versão otimizada para envio</p>}
      <button type="button" onClick={onOptimize} className="w-full cursor-pointer rounded-md border border-white/20 px-2 py-2 text-sm text-rose-100 transition-colors hover:border-rose-300 hover:bg-white/5">{optimized ? 'Restaurar original' : 'Reduzir tamanho do vídeo'}</button>
    </div>}
    {children}
  </li>;
}
