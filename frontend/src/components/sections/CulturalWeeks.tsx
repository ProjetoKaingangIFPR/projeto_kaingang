import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Images, Music2, X } from 'lucide-react';

type Photo = { src: string; thumbnail?: string; caption: string; type?: string };
type Album = { id: string; title: string; year: number; photos: Photo[] };

function CulturalMedia({ record, year, expanded = false }: { record: Photo; year: number; expanded?: boolean }) {
  const [failed, setFailed] = useState(false);
  const label = record.caption || 'Registro do evento de ' + year;
  const image = 'h-full min-h-0 w-full object-contain';
  return <div className={'grid place-items-center overflow-hidden bg-black ' + (expanded ? 'h-[65svh]' : 'aspect-[4/3]')}>
    {failed ? <p role="alert" className="p-6 text-center">Este navegador não conseguiu abrir o registro. <a href={record.src} download className="block underline hover:text-red-300">Baixar arquivo</a></p>
      : record.type?.startsWith('audio/') ? <div className="flex w-full max-w-lg flex-col items-center gap-5 p-6"><Music2 size={40} className="text-red-300" aria-hidden="true"/><audio controls preload="metadata" src={record.src} aria-label={label} onError={() => setFailed(true)} className="w-full"/></div>
      : record.type?.startsWith('video/') ? <video controls playsInline preload="metadata" src={record.src} aria-label={label} onError={() => setFailed(true)} className={image}/>
      : <img src={record.src} alt={label} onError={() => setFailed(true)} className={image}/>}
  </div>;
}

export function CulturalWeeks() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [eventId, setEventId] = useState('');
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const events = albums.filter(item => item.year === year);
  const album = events.find(item => item.id === eventId) ?? events[0];
  const photo = album?.photos[index];

  function load() {
    setLoading(true); setError('');
    fetch('/api/cultural-weeks').then(async response => {
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(item => typeof item.id === 'string' && typeof item.title === 'string' && Number.isInteger(item.year) &&
        Array.isArray(item.photos) && item.photos.every((image: Photo) =>
          typeof image.src === 'string' && typeof image.caption === 'string' && (image.type === undefined || typeof image.type === 'string')))) throw new Error();
      const rows = (data as Album[]).filter(item => item.photos.length).sort((a, b) => b.year - a.year);
      setAlbums(rows); setYear(rows[0]?.year ?? null); setEventId(rows[0]?.id ?? ''); setIndex(0);
    }).catch(() => setError('Não foi possível carregar os álbuns.')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => {
    if (!expanded) return;
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, [expanded]);
  const controls = 'inline-flex items-center justify-center gap-2 rounded border border-white/25 px-3 py-2 text-sm transition-colors enabled:cursor-pointer enabled:hover:border-red-300 enabled:hover:bg-[#730000] disabled:opacity-30';
  function navigation() {
    return <div className="flex items-center justify-between gap-3">
      <button type="button" className={controls} disabled={!index} onClick={() => setIndex(index - 1)}><ChevronLeft size={17}/> Anterior</button>
      <span aria-live="polite" className="text-sm tabular-nums text-white/60">{index + 1} / {album?.photos.length}</span>
      <button type="button" className={controls} disabled={!album || index + 1 >= album.photos.length} onClick={() => setIndex(index + 1)}>Próxima <ChevronRight size={17}/></button>
    </div>;
  }
  return <section id="semanas-culturais" aria-labelledby="semanas-titulo" className="scroll-mt-20 border-t border-white/15 bg-neutral-900 px-6 py-14 sm:px-10 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <h2 id="semanas-titulo" className="text-3xl sm:text-5xl">Eventos da escola</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-white/65">Encontros, atividades e memórias da escola. Escolha o ano e abra o álbum de um evento.</p>
      {loading ? <p role="status" className="mt-8">Carregando álbuns…</p> : error ? <p role="alert" className="mt-8">{error} <button onClick={load} className="underline hover:text-red-300">Tentar novamente</button></p> :
        !albums.length && <div className="mt-8 flex items-center gap-4 rounded-lg border border-white/15 p-6 text-white/65"><Images aria-hidden="true"/><p>Os registros dos eventos da escola serão reunidos aqui por ano.</p></div>}
      {!!albums.length && <>
        <nav aria-label="Ano do evento" className="my-8 flex gap-3 overflow-x-auto border-b border-white/15 pb-4">
          {Array.from(new Set(albums.map(item => item.year))).map(eventYear => <button key={eventYear} aria-pressed={year === eventYear} onClick={() => { setYear(eventYear); setEventId(''); setIndex(0); }}
            className={'shrink-0 rounded px-5 py-3 text-lg transition-colors focus-visible:outline-2 focus-visible:outline-red-300 ' +
              (year === eventYear ? 'bg-[#8B0000] text-white' : 'bg-neutral-800 text-white/65 hover:bg-neutral-700 hover:text-white')}>{eventYear}</button>)}
        </nav>
        <nav aria-label="Eventos do ano" className="mb-6 flex flex-wrap gap-3">
          {events.map(event => <button key={event.id} aria-pressed={album?.id === event.id}
            className={controls + (album?.id === event.id ? ' border-red-300 bg-[#730000]' : '')}
            onClick={() => { setEventId(event.id); setIndex(0); }}>{event.title}</button>)}
        </nav>
        {album && photo && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <figure className="min-w-0">
            {!expanded && <CulturalMedia key={photo.src} record={photo} year={album.year}/>}
            <button onClick={() => setExpanded(true)} aria-label={'Ampliar registro ' + (index + 1) + ' de ' + year}
              className={controls + ' mt-3'}>Ampliar registro</button>
            {photo.caption && <figcaption className="mt-3 text-sm leading-relaxed text-white/70">{photo.caption}</figcaption>}
            <div className="mt-4">{navigation()}</div>
          </figure>
          <div>
            <h3 className="text-2xl">{album.title}</h3>
            <p className="mb-4 mt-1 text-sm text-white/50">{album.photos.length} {album.photos.length === 1 ? 'registro' : 'registros'}</p>
            <div aria-label="Registros do álbum" className="grid max-h-[32rem] grid-cols-3 gap-2 overflow-y-auto p-1 lg:grid-cols-2">
              {album.photos.map((item, position) => <button key={position} aria-label={'Ver registro ' + (position + 1)} aria-pressed={index === position} onClick={() => setIndex(position)}
                className={'grid aspect-square place-items-center overflow-hidden rounded border-2 bg-neutral-800 transition-opacity hover:opacity-100 ' + (index === position ? 'border-red-400' : 'border-transparent opacity-55')}>
                {item.type?.startsWith('audio/') ? <Music2 aria-hidden="true"/> : item.type?.startsWith('video/') ? <Film aria-hidden="true"/> : <img loading="lazy" decoding="async" src={item.thumbnail ?? item.src} alt="" className="size-full object-cover"/>}
              </button>)}
            </div>
          </div>
        </div>}
      </>}
    </div>
    {expanded && photo && <dialog ref={dialog} aria-label={album?.title + ' · ' + year} onCancel={event => { event.preventDefault(); setExpanded(false); }}
      className="m-auto w-[min(96vw,75rem)] rounded-lg bg-neutral-950 p-4 text-white backdrop:bg-black/90">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-xl">{album?.title} · {year}</h3><button autoFocus onClick={() => setExpanded(false)} className={controls}><X size={17}/> Fechar</button></div>
      <CulturalMedia key={photo.src} record={photo} year={year!} expanded/>
      {photo.caption && <p className="my-3 text-sm text-white/70">{photo.caption}</p>}
      <div className="mt-3">{navigation()}</div>
    </dialog>}
  </section>;
}
