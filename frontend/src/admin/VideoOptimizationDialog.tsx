import { useEffect, useRef, useState } from 'react';
import { useMediaUrl } from './MediaTile';
import { ArrowRight, Check, LoaderCircle, Sparkles, X } from 'lucide-react';

function size(bytes: number) {
  return (bytes / (bytes >= 1e9 ? 1e9 : 1e6)).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + (bytes >= 1e9 ? ' GB' : ' MB');
}

function ComparisonVideo({ file, label, onPlayable }: { file: File; label: string; onPlayable?: (ok: boolean) => void }) {
  const url = useMediaUrl(file);
  return <figure className="min-w-0">
    <figcaption className="mb-2 flex justify-between gap-2 text-sm"><span>{label}</span><strong>{size(file.size)}</strong></figcaption>
    {url && <video controls playsInline preload="metadata" aria-label={label} src={url} onPlay={event => {
      event.currentTarget.closest('dialog')?.querySelectorAll('video').forEach(video => {
        if (video !== event.currentTarget) video.pause();
      });
    }} onCanPlay={() => onPlayable?.(true)}
      onError={() => onPlayable?.(false)} className="aspect-video w-full rounded bg-black object-contain"/>}
  </figure>;
}

export default function VideoOptimizationDialog({ original, onApprove, onClose }: {
  original: File; onApprove: (file: File) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [playable, setPlayable] = useState(false);
  const [started, setStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (!started) return;
    const controller = new AbortController();
    async function prepare() {
      try {
        const { optimizeVideo } = await import('./optimizeVideo');
        const file = await optimizeVideo(original, controller.signal, setProgress);
        if (!controller.signal.aborted) setCandidate(file);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'A conversão falhou.');
      }
    }
    void prepare();
    return () => controller.abort();
  }, [original, started]);
  return <dialog ref={dialog} aria-labelledby="optimization-title" onCancel={e => { e.preventDefault(); onClose(); }}
    className="m-auto max-h-[90svh] w-[min(94vw,56rem)] overflow-auto rounded-xl border border-white/15 bg-[#211e1c] text-white shadow-2xl backdrop:bg-black/80">
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:px-7">
      <div><h2 id="optimization-title" className="text-2xl">Preparar vídeo para envio</h2>
      <p className="mt-1 break-all text-sm text-stone-300">{original.name}</p></div>
      <button type="button" aria-label={started && !candidate && !error ? 'Cancelar conversão e fechar' : 'Fechar'} onClick={onClose} className="shrink-0 rounded p-2 hover:bg-white/10"><X size={20}/></button>
    </header>
    <div className="space-y-5 p-5 sm:p-7">
    {error ? <p role="alert" className="text-amber-200">{error} O original continua selecionado.</p> : candidate ? <>
      <div className="rounded-lg border border-green-400/30 bg-green-950/40 p-4">
        <p className="inline-flex items-center gap-2 font-semibold text-green-200"><Check size={18}/> Cópia pronta para comparar</p>
        <p className="mt-2 flex items-center gap-3 text-xl">{size(original.size)} <ArrowRight size={18}/> <strong>{size(candidate.size)}</strong></p>
        <p className="mt-1 text-sm text-stone-300">{size(original.size - candidate.size)} a menos · {((1 - candidate.size / original.size) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de economia</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <ComparisonVideo label="Original" file={original}/>
        <ComparisonVideo label="Versão otimizada" file={candidate} onPlayable={ok => { setPlayable(ok); setPlaybackError(!ok); }}/>
      </div>
      <p className="text-sm text-stone-300">Reproduza as duas versões e confira os detalhes da imagem e o som antes de escolher.</p>
      {playbackError && <p role="alert" className="text-amber-200">A cópia não abriu neste navegador. Escolha o original para continuar.</p>}
    </> : !started ? <>
      <div className="flex items-center gap-3 rounded-lg bg-white/5 p-4"><Sparkles className="text-rose-200"/><span>Arquivo selecionado <strong className="ml-2">{size(original.size)}</strong></span></div>
      <p>Prepare uma cópia menor em alta qualidade. Ao terminar, você poderá comparar as versões e escolher qual será enviada.</p>
      <p className="text-sm text-stone-300">O processamento acontece neste dispositivo e pode levar vários minutos. Mantenha esta aba aberta. O tamanho final depende do vídeo.</p>
    </> : <div role="status" className="rounded-lg bg-white/5 p-5"><p className="flex items-center gap-2"><LoaderCircle size={18} className="animate-spin"/>Preparando vídeo · {progress}%</p>
      <progress aria-label="Progresso da conversão" max={100} value={progress} className="mt-2 block w-full accent-rose-400"/>
    </div>}
    </div>
    <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-white/10 bg-[#211e1c] p-5">
      <button onClick={onClose} className="rounded border border-white/30 px-4 py-2 hover:bg-white/10">{!started || candidate || error ? 'Manter original' : 'Cancelar conversão'}</button>
      {candidate && <button disabled={!playable} onClick={() => onApprove(candidate)} className="rounded bg-[#a52a37] px-4 py-2 font-semibold enabled:hover:bg-[#bd3543] disabled:opacity-50">Usar versão otimizada</button>}
      {!started && <button onClick={() => setStarted(true)} className="inline-flex items-center gap-2 rounded bg-[#a52a37] px-4 py-2 font-semibold hover:bg-[#bd3543]"><Sparkles size={16}/> Preparar cópia menor</button>}
    </footer>
  </dialog>;
}
