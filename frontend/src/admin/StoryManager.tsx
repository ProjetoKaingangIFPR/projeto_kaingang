import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { StoryFile } from '../components/sections/StoryGallery';
import { api, ApiError } from './api';

type Storage = { files: StoryFile[]; capacity: number };
type Reservation = { ids: string[]; chunkSize: number };
const endpoint = '/api/admin/stories';
const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime'];
function bytes(value: number) {
  const unit = value >= 1e9 ? 'GB' : value >= 1e6 ? 'MB' : value >= 1e3 ? 'kB' : 'B';
  const divisor = { GB: 1e9, MB: 1e6, kB: 1e3, B: 1 }[unit];
  return (value / divisor).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ' + unit;
}

export default function StoryManager({ onClose }: { onClose: () => void }) {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const refresh = async () => {
    try {
      setStorage(await api<Storage>(endpoint));
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
  }

  const selected = files.reduce((sum, file) => sum + file.size, 0);
  const occupied = storage?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const reserved = storage?.files.filter(file => file.status !== 'ready').reduce((sum, file) => sum + file.size, 0) ?? 0;
  const available = (storage?.capacity ?? 0) - occupied;
  const exceeds = !reservation && selected > available;
  const invalid = files.some(file => !file.size || !formats.includes(file.type));

  async function upload() {
    const batch = reservation ?? await api<Reservation>(endpoint, {
      method: 'POST', body: JSON.stringify({ title: title.trim(), files: files.map(({ name, size, type }) => ({ name, size, type })) }),
    });
    setReservation(batch);
    const { ids, chunkSize } = batch;
    setUploadTotal(selected);
    setSent(0);
    await refresh();
    let done = 0;
    for (const [i, file] of files.entries()) {
      const path = endpoint + '/' + ids[i];
      const { published } = await api<{ published?: boolean }>(path + '/start', { method: 'POST' });
      if (!published) {
        const parts: { partNumber: number; etag: string }[] = [];
        for (let offset = 0; offset < file.size; offset += chunkSize) {
          const part = file.slice(offset, offset + chunkSize);
          const put = () => api<{ partNumber: number; etag: string }>(path + '/parts/' + (parts.length + 1), {
            method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: part,
          });
          try { parts.push(await put()); }
          catch (err) {
            if (err instanceof ApiError && err.status < 500 && err.status !== 429) throw err;
            await new Promise(resolve => setTimeout(resolve, 1200));
            parts.push(await put());
          }
          done += part.size;
          setSent(done);
        }
        await api(path + '/finish', { method: 'POST', body: JSON.stringify(parts) });
      } else {
        done += file.size;
        setSent(done);
      }
      setFiles(current => current.slice(1));
      setReservation({ ids: ids.slice(i + 1), chunkSize });
    }
    setReservation(null);
    setTitle('');
    setMessage('História publicada.');
  }

  async function remove(file: StoryFile) {
    await api(endpoint + '/' + file.id, { method: 'DELETE' });
    if (reservation?.ids.includes(file.id)) {
      const index = reservation.ids.indexOf(file.id);
      const ids = reservation.ids.filter(id => id !== file.id);
      setReservation(ids.length ? { ...reservation, ids } : null);
      setFiles(current => current.filter((_, i) => i !== index));
    }
    setMessage('Arquivo removido.');
  }

  return <main aria-labelledby="story-manager-title" className="min-h-screen bg-neutral-950 px-5 py-8 text-white sm:px-8 sm:py-12">
    <div className="mx-auto max-w-3xl">
    <button disabled={busy} className="mb-8 inline-flex items-center gap-2 text-sm underline underline-offset-4 transition-colors enabled:cursor-pointer enabled:hover:text-red-300 disabled:opacity-50" onClick={onClose}>
      <ArrowLeft size={16} aria-hidden="true" /> Voltar ao painel
    </button>
    <h1 id="story-manager-title" className="mb-6 text-4xl font-semibold">Histórias contadas</h1>
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-75">
      {storage ? <section className="space-y-2 rounded bg-neutral-800 p-4">
        <h3 className="text-xl">Armazenamento das histórias</h3>
        <p><strong>{bytes(available)} disponíveis</strong> de {bytes(storage.capacity)}</p>
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
      </section> : <button onClick={() => perform(refresh)}>Carregar armazenamento</button>}
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(upload); }}>
        <h3 className="text-xl">Nova história</h3>
        <label className="block">Título <input required disabled={!!reservation} maxLength={180} value={title} onChange={e => setTitle(e.target.value)}
          className="mt-1 block w-full rounded border border-white/30 bg-neutral-900 p-2" /></label>
        <label className="block">Fotos e vídeos
          <input type="file" multiple disabled={!!reservation} accept={formats.join(',')} className="my-2 block w-full file:mr-2 file:rounded file:bg-neutral-700 file:p-2"
            onChange={e => { const added = Array.from(e.target.files || []); setFiles(current => [...current, ...added]); e.target.value = ''; }} />
        </label>
        {!!files.length && <ul className="max-h-52 space-y-2 overflow-auto">{files.map((file, index) =>
          <li key={index} className="flex items-center justify-between gap-3"><span className="break-all">{file.name} · {bytes(file.size)}</span>
            {!reservation && <button type="button" className="underline underline-offset-4 transition-colors hover:text-red-300 enabled:cursor-pointer disabled:opacity-50" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>Retirar</button>}</li>)}</ul>}
        {!uploadTotal && <p>Seleção de {bytes(selected)}{storage && !exceeds && ' · Após o envio, ' + bytes(reservation ? available : available - selected) + ' disponíveis.'}</p>}
        {storage && exceeds && !uploadTotal && <p role="alert" className="text-amber-300">A seleção excede o saldo em {bytes(selected - available)}. Retire arquivos ou ajuste a cota.</p>}
        {invalid && <p role="alert">Retire arquivos vazios ou incompatíveis. Formatos aceitos incluem JPEG, PNG, WebP, GIF, AVIF, MP4, WebM e MOV.</p>}
        <button disabled={!storage || !files.length || !title.trim() || invalid || exceeds}
          className="rounded bg-[#8B0000] px-5 py-2 font-semibold transition-colors enabled:cursor-pointer enabled:hover:bg-[#a30000] disabled:opacity-50">{reservation ? 'Continuar envio' : 'Publicar história'}</button>
      </form>
      {!!storage?.files.length && <section>
        <h3 className="mb-3 text-xl">Arquivos do acervo</h3>
        <ul className="divide-y divide-white/15">{storage.files.map(file => <li key={file.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0 break-words"><strong>{file.title}</strong><br />{file.name} · {bytes(file.size)} · {file.status === 'ready' ? 'Publicado' : 'Reserva pendente'}</div>
          <button className="underline underline-offset-4 transition-colors hover:text-red-300 enabled:cursor-pointer disabled:opacity-50" onClick={() => {
            if (window.confirm('Remover ' + file.name + ' do acervo e liberar o espaço?'))
              void perform(() => remove(file));
          }}>Remover</button>
        </li>)}</ul>
      </section>}
    </fieldset>
    {!!uploadTotal && <div role="status" className="mt-4">Enviando {bytes(sent)} de {bytes(uploadTotal)}
      <progress className="block w-full" max={uploadTotal} value={sent} /></div>}
    {message && <p role="status" className="mt-4">{message}</p>}
    {error && <p role="alert" className="mt-4 text-amber-300">{error} {uploadTotal > 0 || reserved > 0 ? 'Envios incompletos podem ser removidos na lista de arquivos.' : ''}</p>}
    </div>
  </main>;
}

