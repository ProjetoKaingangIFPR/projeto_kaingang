import { useEffect, useState } from 'react';
import { api } from '../../admin/api';

export interface StoryFile {
  id: string;
  collection: string;
  title: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'ready' | 'deleting';
}

export function StoryGallery() {
  const [files, setFiles] = useState<StoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collection, setCollection] = useState('');
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api<StoryFile[]>('/api/stories').then(rows => {
      setFiles(rows);
      setCollection(rows[0]?.collection || '');
      setIndex(0);
    }).catch(() => setError('Não foi possível carregar as histórias.')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  const groups = new Map(files.map(file => [file.collection, file.title]));
  const items = files.filter(file => file.collection === collection);
  const current = items[index];
  const url = current && '/api/stories/' + current.id + '/media';

  return <section id="historias-conteudo" tabIndex={-1} aria-label="Acervo de histórias"
    className="min-h-[70svh] scroll-mt-14 bg-neutral-900 px-5 py-14 text-white md:scroll-mt-16">
    <div className="mx-auto max-w-5xl space-y-6">
      <h2 className="text-3xl">Histórias do acervo</h2>
      {loading ? <p role="status">Carregando histórias…</p> : error ?
        <p role="alert">{error} <button className="underline" onClick={load}>Tentar novamente</button></p> :
        !files.length && <p>Ainda não há histórias publicadas.</p>}
      {current && <>
        <label className="block">Escolha uma história
          <select className="mt-2 block w-full rounded border border-white/30 bg-neutral-800 p-3" value={collection}
            onChange={event => { setCollection(event.target.value); setIndex(0); setFailed(''); }}>
            {Array.from(groups, ([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <figure>
          <div className="grid aspect-video place-items-center bg-black">
            {failed === current.id ? <p role="alert" className="p-4">O navegador não conseguiu exibir este arquivo. <a className="underline" href={url} download={current.name}>Baixar arquivo</a></p> :
              current.type.startsWith('video/') ?
                <video key={current.id} controls playsInline preload="metadata" aria-label={current.name}
                  className="h-full min-h-0 w-full object-contain" src={url} onError={() => setFailed(current.id)}
                  onEnded={() => setIndex(i => Math.min(i + 1, items.length - 1))} /> :
                <img className="h-full min-h-0 w-full object-contain" src={url} alt={current.name} onError={() => setFailed(current.id)} />}
          </div>
          <figcaption aria-live="polite" className="mt-3 break-words">{index + 1} de {items.length} · {current.name}</figcaption>
        </figure>
        <div className="flex gap-6">
          <button disabled={!index} className="underline disabled:opacity-40" onClick={() => setIndex(index - 1)}>Anterior</button>
          <button disabled={index + 1 === items.length} className="underline disabled:opacity-40" onClick={() => setIndex(index + 1)}>Próximo</button>
        </div>
      </>}
    </div>
  </section>;
}

