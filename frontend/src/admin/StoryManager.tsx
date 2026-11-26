import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Plus, Trash2, Upload } from 'lucide-react';
import type { StoryFile } from '../components/sections/StoryGallery';
import { api, ApiError } from './api';
import { galleryImageUrl, MediaTile, type MediaFile } from './MediaTile';
import MediaPreview from './MediaPreview';
import { uploadParts, type UploadedPart } from './uploadParts';
import { mediaFormats as formats, mediaAccept, normalizeMedia } from './mediaFormats';
import RecordMetadataEditor, { type RecordMetadata } from './RecordMetadataEditor';

type Storage = { files: StoryFile[]; capacity: number; occupied?: number; reserved?: number };
type Reservation = { ids: string[]; chunkSize: number };
const endpoint = '/api/admin/stories';
function bytes(value: number) {
  const unit = value >= 1e9 ? 'GB' : value >= 1e6 ? 'MB' : value >= 1e3 ? 'kB' : 'B';
  const divisor = { GB: 1e9, MB: 1e6, kB: 1e3, B: 1 }[unit];
  return (value / divisor).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ' + unit;
}

export default function StoryManager({ onClose, culturalWeeks = false }: { onClose: () => void; culturalWeeks?: boolean }) {
  const [culturalYear, setCulturalYear] = useState(String(new Date().getFullYear()));
  const pageTitle = culturalWeeks ? 'Memórias da Escola' : 'Histórias contadas';
  const [preview, setPreview] = useState<{ files: MediaFile[]; index: number } | null>(null);
  const [albumId, setAlbumId] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [deletion, setDeletion] = useState<{ total: number; done: number; failed: number; name: string } | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const originals = useRef(new WeakMap<File, File>());
  const metadata = useRef(new WeakMap<File, RecordMetadata>());
  const [preparing, setPreparing] = useState<{ name: string; index: number; total: number; percent: number } | null>(null);
  const preparationController = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const cancelRequested = useRef(false);
  const activeTransfer = useRef<AbortController | null>(null);
  const receipts = useRef<{ id: string; parts: Map<number, UploadedPart> } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [currentFile, setCurrentFile] = useState('');
  const progressPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (uploadTotal) progressPanel.current?.scrollIntoView({ block: 'start' });
  }, [uploadTotal]);
  const refresh = async () => {
    try {
      setStorage(await api<Storage>(culturalWeeks ? '/api/admin/cultural-weeks' : endpoint));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new Error('A API deste ambiente ainda não disponibiliza o acervo de histórias. Verifique a versão do Worker que atende o site.');
      }
      throw err;
    }
  };
  const report = (err: unknown) => setError(err instanceof Error ? err.message : 'Falha na operação.');
  useEffect(() => {
    refresh().catch(report);
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); } catch (err) { report(err); }
    try { await refresh(); } catch (err) { report(err); }
    setBusy(false);
    setUploadTotal(0);
    setCancelling(false);
    setCurrentFile('');
  }

  const selected = files.reduce((sum, file) => sum + file.size, 0);
  const collections = new Map<string, StoryFile[]>();
  for (const file of storage?.files ?? []) {
    const group = collections.get(file.collection);
    if (group) group.push(file);
    else collections.set(file.collection, [file]);
  }
  const album = collections.get(albumId);
  const occupied = storage?.occupied ?? storage?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const reserved = storage?.reserved ?? storage?.files.filter(file => file.status !== 'ready').reduce((sum, file) => sum + file.size, 0) ?? 0;
  const available = (storage?.capacity ?? 0) - occupied;
  const exceeds = !reservation && selected > available;
  const invalid = files.some(file => !file.size || !formats.includes(file.type));
  const toPrepare = reservation ? [] : files.filter(file => file.type.startsWith('video/') && !originals.current.has(file));

  async function prepareVideos() {
    const controller = new AbortController();
    preparationController.current = controller;
    const prepared = [...files];
    try {
      if (toPrepare.length) {
        const { optimizeVideo } = await import('./optimizeVideo');
        for (const [index, file] of toPrepare.entries()) {
          controller.signal.throwIfAborted();
          setPreparing({ name: file.name, index: index + 1, total: toPrepare.length, percent: 0 });
          try {
            const candidate = await optimizeVideo(file, controller.signal, percent =>
              setPreparing({ name: file.name, index: index + 1, total: toPrepare.length, percent }));
            originals.current.set(candidate, file);
            prepared[prepared.indexOf(file)] = candidate;
            setFiles(current => current.map(item => item === file ? candidate : item));
          } catch (err) {
            if (controller.signal.aborted) throw err;
            throw new Error(file.name + ': ' + (err instanceof Error ? err.message : 'Falha ao otimizar.') +
              ' Retire este arquivo ou tente novamente para continuar o envio.');
          }
        }
      }
      controller.signal.throwIfAborted();
      if (prepared.reduce((sum, file) => sum + file.size, 0) > available && !reservation) {
        throw new Error('A seleção otimizada ultrapassa o espaço disponível. Retire arquivos ou ajuste a cota.');
      }
      setPreparing(null);
      await upload(prepared);
    } catch (err) {
      if (!controller.signal.aborted) throw err;
      setMessage('Envio cancelado durante a otimização. As cópias já preparadas continuam na seleção.');
    } finally {
      setPreparing(null);
      preparationController.current = null;
    }
  }

  async function upload(uploadFiles: File[]) {
    cancelRequested.current = false;
    const transfer = new AbortController();
    activeTransfer.current = transfer;
    setUploadTotal(uploadFiles.reduce((sum, file) => sum + file.size, 0));
    setSent(0);
    const batch = reservation ?? await api<Reservation>(culturalWeeks ? '/api/admin/cultural-weeks' : endpoint, {
      method: 'POST', body: JSON.stringify({ title: title.trim(), kind: culturalWeeks ? 'culture' : 'story', ...(culturalWeeks ? { year: Number(culturalYear) } : {}), files: uploadFiles.map(file => ({
        name: file.name, size: file.size, type: file.type,
        ...metadata.current.get(originals.current.get(file) ?? file),
      })) }),
    });
    setReservation(batch);
    const { ids, chunkSize } = batch;
    let done = 0;
    let completed = 0;
    try {
    for (const [i, file] of uploadFiles.entries()) {
      if (cancelRequested.current) break;
      setCurrentFile(file.name);
      const path = endpoint + '/' + ids[i];
      const { published } = await api<{ published?: boolean }>(path + '/start', { method: 'POST' });
      if (!published) {
        if (receipts.current?.id !== ids[i]) receipts.current = { id: ids[i], parts: new Map() };
        const parts = await uploadParts(file, path, chunkSize, receipts.current.parts, transfer.signal, size => {
          done += size;
          setSent(done);
        });
        if (cancelRequested.current) break;
        await api(path + '/finish', { method: 'POST', body: JSON.stringify(parts) });
      } else {
        done += file.size;
        setSent(done);
      }
      setFiles(current => current.slice(1));
      receipts.current = null;
      completed++;
      setReservation({ ids: ids.slice(i + 1), chunkSize });
    }
    } catch (err) {
      if (!cancelRequested.current) throw err;
    }
    if (cancelRequested.current && completed < ids.length) {
      const remainingIds: string[] = [];
      const remainingFiles: File[] = [];
      for (let i = completed; i < ids.length; i++) {
        try {
          await api(endpoint + '/' + ids[i] + '?pendingOnly=1', { method: 'DELETE' });
        } catch {
          remainingIds.push(ids[i]);
          remainingFiles.push(uploadFiles[i]);
        }
      }
      setReservation(remainingIds.length ? { ids: remainingIds, chunkSize } : null);
      setFiles(remainingIds.length ? remainingFiles : uploadFiles.slice(completed));
      if (remainingIds.length) throw new Error('Alguns arquivos pendentes ainda ocupam espaço. Você pode removê-los em Arquivos do acervo.');
      setMessage('Envio cancelado. O espaço reservado foi liberado. Arquivos já publicados continuam no acervo.');
      return;
    }
    setReservation(null);
    setTitle('');
    setMessage('História publicada.');
    setEditing(false);
  }

  async function remove(file: StoryFile, silent = false) {
    await api(endpoint + '/' + file.id, { method: 'DELETE' });
    if (reservation?.ids.includes(file.id)) {
      const index = reservation.ids.indexOf(file.id);
      const removedFile = files[index];
      setReservation(current => {
        if (!current) return null;
        const ids = current.ids.filter(id => id !== file.id);
        return ids.length ? { ...current, ids } : null;
      });
      setFiles(current => current.filter(item => item !== removedFile));
    }
    if (!silent) setMessage('Arquivo removido.');
  }

  async function removeSelected(entireStory = false) {
    const selectedFiles = album?.filter(file => entireStory || selectedIds.includes(file.id)) ?? [];
    const subject = entireStory ? `a história “${album?.[0].title}” e seus ${selectedFiles.length} arquivos` : `${selectedFiles.length} arquivos desta história`;
    if (!selectedFiles.length || !window.confirm(`Excluir permanentemente ${subject} e liberar ${bytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    let done = 0;
    let failed = 0;
    const removedIds = new Set<string>();
    setDeletion({ total: selectedFiles.length, done, failed, name: '' });
    try {
      for (const file of selectedFiles) {
        setDeletion({ total: selectedFiles.length, done, failed, name: file.name });
        try {
          await remove(file, true);
          removedIds.add(file.id);
          setSelectedIds(current => current.filter(id => id !== file.id));
        } catch {
          failed++;
        }
        done++;
        setDeletion({ total: selectedFiles.length, done, failed, name: file.name });
      }
      setMessage(entireStory && !failed ? 'História excluída.' : `${done - failed} de ${selectedFiles.length} arquivos removidos.`);
      if (failed) {
        setSelectedIds(selectedFiles.filter(file => !removedIds.has(file.id)).map(file => file.id));
        setSelecting(true);
        setError(`${failed} arquivos não foram removidos. Eles continuam selecionados para você tentar novamente.`);
      } else {
        setSelecting(false);
        setSelectedIds([]);
        if (entireStory) setAlbumId('');
      }
      await refresh();
    } catch (err) {
      report(err);
      await refresh().catch(report);
    } finally {
      setBusy(false);
      setDeletion(null);
    }
  }

  return <main aria-labelledby="story-manager-title" className="min-h-screen bg-[#171514] text-stone-100">
    <header className="relative isolate overflow-hidden border-b border-white/15 bg-[#520e17]">
      <img src="/images/intro_visita_virtual.jpg" alt="" className="absolute inset-y-0 right-0 -z-10 h-full w-2/3 object-cover object-center opacity-70 [mask-image:linear-gradient(to_right,transparent,black)] sm:w-1/2" />
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-10 sm:py-10">
    <button disabled={busy} className="mb-8 inline-flex items-center gap-2 text-sm text-white/90 enabled:cursor-pointer enabled:hover:underline disabled:opacity-50" onClick={onClose}>
      <ArrowLeft size={16} aria-hidden="true" /> Voltar ao painel
    </button>
    <h1 id="story-manager-title" className="text-4xl leading-tight tracking-tight text-white sm:text-6xl">{pageTitle}</h1>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-10 sm:py-10">
    {!!uploadTotal && <section ref={progressPanel} aria-label="Progresso do envio" className="sticky top-0 z-10 mb-5 space-y-2 rounded-xl border border-red-400/40 bg-neutral-900 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong role="status">{cancelling ? 'Cancelando envio…' : 'Enviando arquivos'} · {Math.floor(sent / uploadTotal * 100)}%</strong>
        <button type="button" disabled={cancelling} className="rounded-lg border border-white/30 px-3 py-2 text-sm enabled:cursor-pointer enabled:hover:bg-white/10 disabled:opacity-50" onClick={() => {
          cancelRequested.current = true;
          activeTransfer.current?.abort();
          setCancelling(true);
        }}>Cancelar envio</button>
      </div>
      <progress aria-label="Total enviado" className="block h-2 w-full accent-red-500" max={uploadTotal} value={sent} />
      <p className="break-words text-sm text-neutral-300">{bytes(sent)} de {bytes(uploadTotal)}{currentFile && ' · ' + currentFile}</p>
    </section>}
    {message && <p role="status" className="mb-5 rounded-lg border border-green-400/30 bg-green-950 p-3">{message}</p>}
    {error && <p role="alert" className="mb-5 rounded-lg border border-amber-400/30 bg-amber-950 p-3 text-amber-200">{error}</p>}
    {preparing && <section role="status" className="sticky top-0 z-20 mb-5 space-y-3 rounded-xl border border-rose-300/40 bg-neutral-900 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><strong>Otimizando vídeo {preparing.index} de {preparing.total}</strong>
        <button type="button" onClick={() => preparationController.current?.abort()} className="rounded border border-white/30 px-3 py-2 hover:bg-white/10">Cancelar otimização</button></div>
      <p className="break-all text-sm">{preparing.name} · {preparing.percent}%</p>
      <progress aria-label="Progresso da otimização" max={100} value={preparing.percent} className="block w-full accent-rose-400"/>
    </section>}
    <fieldset disabled={busy} className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      {storage ? <section className="order-last space-y-3 border-t border-stone-600 pt-5 lg:col-start-2 lg:row-start-1">
        <h2 className="text-xl">Armazenamento do acervo</h2>
        <p className="text-sm text-white/60">Espaço compartilhado pelas histórias e semanas culturais.</p>
        <p><strong>{bytes(available)} disponíveis</strong> de {bytes(storage.capacity)}</p>
        <progress aria-label="Espaço ocupado no acervo" className="block h-2 w-full accent-rose-400" value={occupied} max={storage.capacity} />
        <p>{bytes(occupied - reserved)} publicados · {bytes(reserved)} reservados</p>
        <details><summary className="cursor-pointer underline underline-offset-4 transition-colors hover:text-red-300">Ajustar cota</summary>
          <form className="mt-3 space-y-2" onSubmit={event => {
            event.preventDefault();
            void perform(async () => {
              await api(endpoint + '/quota', { method: 'PUT', body: JSON.stringify({ capacity: Math.round(Number(limit) * 1e9) }) });
              setLimit('');
              setMessage('Cota atualizada.');
            });
          }}>
            <label className="block">Nova cota em GB <input required type="number" min="0.001" step="0.001" value={limit}
              onChange={e => setLimit(e.target.value)} className="w-28 rounded bg-neutral-700 p-2" /></label>
            <p className="text-sm">A cota controla os envios deste acervo. O uso do R2 pode gerar cobrança na conta Cloudflare.</p>
            <button className="underline underline-offset-4 transition-colors hover:text-red-300 enabled:cursor-pointer disabled:opacity-50">Salvar cota</button>
          </form>
        </details>
      </section> : <button className="order-last rounded-lg border border-white/20 p-4 hover:bg-neutral-800 lg:col-start-2 lg:row-start-1" onClick={() => perform(refresh)}>Carregar armazenamento</button>}
      {editing ? <form className="min-w-0 space-y-5 rounded-xl bg-[#292523] p-5 sm:p-8 lg:col-start-1 lg:row-start-1" onSubmit={event => { event.preventDefault(); void perform(prepareVideos); }}>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-white"><ArrowLeft size={16}/> Acervo</button>
        <h2 className="text-3xl">{culturalWeeks ? 'Novo álbum' : 'Nova história'}</h2>
        {culturalWeeks && <label className="block">Ano da semana cultural
          <input type="number" required min={1900} max={2100} step={1} disabled={!!reservation} value={culturalYear} onChange={event => setCulturalYear(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-white/25 bg-neutral-950 p-3"/>
        </label>}
        <label className="block">{culturalWeeks ? 'Título do álbum' : 'Título da história'} <input required disabled={!!reservation} maxLength={180} value={title} onChange={e => setTitle(e.target.value)}
          placeholder={culturalWeeks ? 'Ex.: Semana cultural da escola' : 'Ex.: Memórias de Maria'} className="mt-2 block w-full rounded-lg border border-white/25 bg-neutral-950 p-3" /></label>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-stone-500 bg-[#211e1c] px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-rose-300 hover:border-rose-300">
          <Upload size={24} className="text-rose-200"/>
          <span className="font-semibold">Escolher fotos, vídeos e áudios</span>
          <span className="text-sm text-stone-300">Você pode escolher vários arquivos de uma vez.</span>
          <input type="file" multiple disabled={!!reservation} accept={mediaAccept} className="sr-only"
            onChange={e => { const added = Array.from(e.target.files || []).map(normalizeMedia); setFiles(current => [...current, ...added]); e.target.value = ''; }} />
        </label>
        {!!files.length && <ul aria-label="Arquivos selecionados" className="grid max-h-[52svh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3">
          {files.map((file, index) => <MediaTile key={file.name + file.lastModified + index} file={file} size={bytes(file.size)}
            onOpen={() => setPreview({ files, index })} onRemove={reservation ? undefined : () => setFiles(current => current.filter((_, i) => i !== index))}>
              <RecordMetadataEditor disabled={!!reservation} value={metadata.current.get(originals.current.get(file) ?? file) ?? { author: null, recorded_on: null }}
                onChange={value => metadata.current.set(originals.current.get(file) ?? file, value)}/>
            </MediaTile>)}
        </ul>}
        {!!files.length && !uploadTotal && <p className="rounded-lg bg-neutral-800 p-3">{files.length} {files.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'} · {bytes(selected)}{storage && !exceeds && ' · Após o envio, ' + bytes(reservation ? available : available - selected) + ' disponíveis.'}</p>}
        {!!toPrepare.length && <p className="text-sm text-stone-300">Ao enviar, os vídeos serão otimizados automaticamente neste dispositivo. Mantenha esta aba aberta até concluir.</p>}
        {storage && exceeds && !uploadTotal && <p role="alert" className="text-amber-300">A seleção excede o saldo em {bytes(selected - available)}. Retire arquivos ou ajuste a cota.</p>}
        {invalid && <p role="alert">Retire arquivos vazios ou incompatíveis. Aceitamos imagens JPEG, PNG, WebP, GIF, AVIF, BMP, TIFF, HEIC e HEIF; vídeos MP4, M4V, MOV, WebM e MKV; áudios MP3, M4A, WAV, OGG, Opus, AAC, FLAC e WebM.</p>}
        <button disabled={!storage || !files.length || !title.trim() || invalid || (exceeds && !toPrepare.length)}
          className="rounded bg-[#8B0000] px-5 py-2 font-semibold transition-colors enabled:cursor-pointer enabled:hover:bg-[#a30000] disabled:opacity-50">{reservation ? 'Continuar envio' : 'Enviar'}</button>
      </form> : <section className="min-w-0 lg:col-start-1 lg:row-start-1">
        {album ? <>
          <button className="mb-4 inline-flex items-center gap-2 text-sm text-stone-300 hover:text-white" onClick={() => { setAlbumId(''); setSelecting(false); setSelectedIds([]); }}><ArrowLeft size={16}/> Todas as histórias</button>
          <h2 className="mb-5 break-words text-3xl">{album[0].title}</h2>{culturalWeeks && <p className="mb-4 text-white/60">Semana cultural {album[0].cultural_year}</p>}
          {renaming ? <form className="mb-5 space-y-3 rounded-lg border border-white/15 bg-neutral-900 p-4" onSubmit={event => {
            event.preventDefault();
            void perform(async () => {
              await api('/api/admin/story-collections/' + albumId, { method: 'PATCH', body: JSON.stringify({ title: newTitle.trim() }) });
              setRenaming(false);
              setMessage('Título atualizado.');
            });
          }}>
            <label className="block text-sm">{culturalWeeks ? 'Título do álbum' : 'Título da história'}
              <input autoFocus required maxLength={180} value={newTitle} onChange={event => setNewTitle(event.target.value)}
                className="mt-2 block w-full rounded border border-white/25 bg-neutral-950 p-3"/>
            </label>
            <div className="flex gap-3">
              <button disabled={!newTitle.trim()} className="rounded bg-[#8B0000] px-4 py-2 hover:bg-[#a30000] disabled:opacity-40">Salvar título</button>
              <button type="button" onClick={() => setRenaming(false)} className="rounded border border-white/25 px-4 py-2 hover:bg-white/10">Cancelar</button>
            </div>
          </form> : <div className="mb-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => { setNewTitle(album[0].title); setRenaming(true); }}
              className="cursor-pointer rounded border border-white/25 px-4 py-2 text-sm hover:bg-white/10">Editar título</button>
            <button type="button" onClick={() => void removeSelected(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded border border-red-300/50 px-4 py-2 text-sm text-red-200 hover:bg-red-950"><Trash2 size={16}/> Excluir história</button>
          </div>}
          <div className="sticky top-0 z-10 mb-5 rounded-xl border border-white/15 bg-neutral-900 p-4 shadow-lg">
            {deletion ? <div role="status" aria-live="polite" className="space-y-2">
              <div className="flex items-center justify-between gap-3"><strong>Excluindo arquivos</strong><span>{deletion.done} de {deletion.total}</span></div>
              <progress aria-label="Progresso da exclusão" value={deletion.done} max={deletion.total} className="block h-2 w-full accent-rose-400"/>
              <p className="truncate text-sm text-stone-300">{deletion.name}</p>
              {!!deletion.failed && <p className="text-sm text-amber-200">{deletion.failed} falhas. Você poderá tentar novamente.</p>}
            </div> : selecting ? <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">{selectedIds.length} selecionados · {bytes(album.filter(file => selectedIds.includes(file.id)).reduce((sum, file) => sum + file.size, 0))}</span>
                <button type="button" className="cursor-pointer text-sm text-stone-300 hover:text-white" onClick={() => { setSelecting(false); setSelectedIds([]); }}>Concluir seleção</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="cursor-pointer text-sm underline hover:text-rose-200" onClick={() => setSelectedIds(selectedIds.length === album.length ? [] : album.map(file => file.id))}>{selectedIds.length === album.length ? 'Desmarcar todos' : 'Selecionar todos'}</button>
                <button type="button" disabled={!selectedIds.length} onClick={() => void removeSelected()} className="inline-flex items-center gap-2 rounded-lg bg-[#a52a37] px-4 py-2.5 text-sm font-semibold enabled:cursor-pointer enabled:hover:bg-[#bd3543] disabled:opacity-40"><Trash2 size={16}/> Excluir selecionados</button>
              </div>
            </> : <button type="button" className="cursor-pointer rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10" onClick={() => setSelecting(true)}>Selecionar arquivos</button>}
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {album.map(file => <MediaTile key={file.id} file={file} size={bytes(file.size)} selected={selectedIds.includes(file.id)} onSelect={selecting ? checked => setSelectedIds(current => checked ? [...current, file.id] : current.filter(id => id !== file.id)) : undefined} onOpen={() => {
              const published = album.filter(item => item.status === 'ready');
              setPreview({ files: published, index: published.indexOf(file) });
            }} onRemove={selecting ? undefined : () => {
              if (window.confirm('Remover ' + file.name + ' do acervo e liberar o espaço?')) void perform(() => remove(file));
            }}>
              {!selecting && <RecordMetadataEditor key={file.id + file.author + file.recorded_on}
                value={{ author: file.author ?? null, recorded_on: file.recorded_on ?? null }} onSave={async value => {
                  await api(endpoint + '/' + file.id, { method: 'PATCH', body: JSON.stringify(value) });
                  await refresh();
                }}/>}
            </MediaTile>)}
          </ul>
        </> : <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl">{culturalWeeks ? 'Acervo das semanas culturais' : 'Acervo'}</h2>
            <button onClick={() => setEditing(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#a52a37] px-4 py-2.5 font-semibold text-white hover:bg-[#bd3543]"><Plus size={18}/>{files.length || title ? (culturalWeeks ? 'Continuar álbum' : 'Continuar história') : (culturalWeeks ? 'Novo álbum' : 'Nova história')}</button>
          </div>
          {storage && !collections.size && <div className="rounded-xl border border-dashed border-stone-600 px-5 py-12 text-center">
            <BookOpen aria-hidden="true" className="mx-auto mb-4 text-rose-300" size={32}/>
            <h3 className="text-2xl">{culturalWeeks ? 'Seu primeiro álbum' : 'Sua primeira história'}</h3><p className="mt-2 text-stone-300">{culturalWeeks ? 'Escolha “Novo álbum” para cadastrar o ano e seus registros.' : 'Escolha “Nova história” para reunir fotos, vídeos e áudios.'}</p>
          </div>}
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from(collections, ([id, group]) => {
              const cover = group.find(file => file.status === 'ready' && file.type.startsWith('image/'));
              return <button key={id} onClick={() => { setAlbumId(id); setSelectedIds([]); setSelecting(false); setRenaming(false); }} className="group min-w-0 cursor-pointer overflow-hidden rounded-lg border border-white/15 bg-[#262321] text-left transition-colors hover:border-rose-300">
                <span className="grid aspect-[16/10] place-items-center overflow-hidden bg-[#48242a]">
                  {cover ? <img loading="lazy" decoding="async" alt="" src={galleryImageUrl(cover)} onError={event => {
                    if (event.currentTarget.src.endsWith('?preview=1')) event.currentTarget.src = '/api/stories/' + cover.id + '/media';
                  }} className="size-full object-cover transition-transform motion-safe:group-hover:scale-[1.03]"/> : <BookOpen size={36}/>}
                </span>
                <span className="block p-4"><span className="font-display block break-words text-2xl leading-tight">{group[0].title}</span>
                <span className="mt-2 block text-sm text-stone-300">{culturalWeeks && <span className="mr-2">{group[0].cultural_year} ·</span>}{group.length} {group.length === 1 ? 'arquivo' : 'arquivos'} · {bytes(group.reduce((sum,file) => sum + file.size, 0))}</span></span>
              </button>;
            })}
          </div>
        </>}
      </section>}
    </fieldset>
    {preview && <MediaPreview files={preview.files} initialIndex={preview.index} onClose={() => setPreview(null)} />}
    </div>
  </main>;
}

