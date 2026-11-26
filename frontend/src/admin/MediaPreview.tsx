import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type MediaFile, useMediaUrl } from './MediaTile';

export default function MediaPreview({ files, initialIndex, onClose }: { files: MediaFile[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const file = files[index];
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
    };
  }, []);

  return <dialog ref={dialog} aria-labelledby="preview-name" onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto w-[min(94vw,64rem)] rounded-xl border border-stone-700 bg-[#211e1c] text-white shadow-xl backdrop:bg-black/85">
    <header className="flex items-center justify-between gap-4 px-5 py-3">
      <h2 id="preview-name" className="min-w-0 break-all text-lg">{file.name}</h2>
      <button autoFocus type="button" onClick={onClose} className="cursor-pointer rounded-md border border-white/30 px-3 py-2 hover:bg-white/10">Fechar</button>
    </header>
    <PreviewContent key={index} file={file}/>
    <nav aria-label="Arquivos da história" className="flex items-center justify-between px-4 py-3 text-sm">
      <button disabled={index === 0} onClick={() => setIndex(index - 1)} className="inline-flex items-center gap-1 rounded px-2 py-2 enabled:hover:bg-white/10 disabled:opacity-35"><ChevronLeft size={18}/> Anterior</button>
      <span aria-live="polite">{index + 1} de {files.length}</span>
      <button disabled={index + 1 === files.length} onClick={() => setIndex(index + 1)} className="inline-flex items-center gap-1 rounded px-2 py-2 enabled:hover:bg-white/10 disabled:opacity-35">Próximo <ChevronRight size={18}/></button>
    </nav>
  </dialog>;
}

function PreviewContent({ file }: { file: MediaFile }) {
  const url = useMediaUrl(file);
  const [failed, setFailed] = useState(false);
  return <div className="grid min-h-40 place-items-center bg-black">
      {url && (failed ? <p role="alert" className="p-6">Este navegador não conseguiu abrir o arquivo. <a href={url} download={file.name} className="underline">Baixar para abrir no dispositivo</a></p>
        : file.type.startsWith('video/') ? <video controls playsInline preload="metadata" aria-label={file.name} src={url} onError={() => setFailed(true)} className="max-h-[72svh] w-full" />
        : <img src={url} alt={file.name} onError={() => setFailed(true)} className="max-h-[72svh] max-w-full object-contain" />)}
    </div>;
}
