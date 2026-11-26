import { useEffect, useRef, useState } from 'react';
import { api } from '../../admin/api';
import { ArrowLeft, BookOpen, Film, Play, ChevronLeft, ChevronRight, Minimize, Maximize, PanelLeftClose, PanelLeftOpen, Music2 } from 'lucide-react';

export interface StoryFile {
  id: string;
  collection: string;
  title: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'ready' | 'deleting';
  author?: string | null;
  recorded_on?: string | null;
}

function mediaLabel(file: StoryFile) {
  return file.type.startsWith('audio/') ? 'Áudio' : file.type.startsWith('video/') ? 'Vídeo' : 'Foto';
}

export function StoryGallery({ onClose }: { onClose?: () => void } = {}) {
  const [files, setFiles] = useState<StoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collection, setCollection] = useState(() => new URLSearchParams(window.location.hash.split('?')[1]).get('historia') ?? '');
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState('');
  const [loaded, setLoaded] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [popup, setPopup] = useState<{ file: StoryFile; left: number; top: number } | null>(null);
  useEffect(() => {
    const dismiss = () => setPopup(null);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  function showDetails(file: StoryFile, button: HTMLButtonElement) {
    if (!file.author && !file.recorded_on) { setPopup(null); return; }
    const rect = button.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const left = rect.right + 10 + width <= window.innerWidth
      ? rect.right + 10 : Math.max(12, rect.left - width - 10);
    setPopup({ file, left, top: Math.max(12, Math.min(rect.top, window.innerHeight - 150)) });
  }
  const container = useRef<HTMLElement>(null);
  const storyTitle = useRef<HTMLHeadingElement>(null);
  const cardButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastCollection = useRef('');
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  function load() {
    setLoading(true);
    setError('');
    api<StoryFile[]>('/api/stories').then(rows => {
      setFiles(rows);
      setIndex(0);
    }).catch(() => setError('Não foi possível carregar as histórias.')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => {
    const update = () => {
      setCollection(new URLSearchParams(window.location.hash.split('?')[1]).get('historia') ?? '');
      setIndex(0);
      setFailed('');
    };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  function chooseStory(id: string) {
    setPopup(null);
    setSidebarOpen(true);
    window.history.pushState({}, '', id ? '#acervo?' + new URLSearchParams({ historia: id }) : '#acervo');
    lastCollection.current = collection;
    setIndex(0);
    setFailed('');
    setCollection(id);
  }
  useEffect(() => {
    if (collection) storyTitle.current?.focus({ preventScroll: true });
    else cardButtons.current.get(lastCollection.current)?.focus({ preventScroll: true });
  }, [collection]);
  async function closeGallery() {
    if (document.fullscreenElement === container.current) await document.exitFullscreen().catch(() => {});
    onClose?.();
  }

  const groups = new Map(files.map(file => [file.collection, file.title]));
  const items = files.filter(file => file.collection === collection).sort((a, b) =>
    a.recorded_on && b.recorded_on ? a.recorded_on.localeCompare(b.recorded_on)
      : a.recorded_on ? -1 : b.recorded_on ? 1 : 0);
  const dates = new Map<string, { file: StoryFile; position: number }[]>();
  items.forEach((file, position) => {
    const date = file.recorded_on ?? '';
    const group = dates.get(date);
    if (group) group.push({ file, position });
    else dates.set(date, [{ file, position }]);
  });
  const current = items[index];
  const url = current && '/api/stories/' + current.id + '/media';
  const previewUrl = (file: StoryFile) => '/api/stories/' + file.id + '/media' +
    (file.type === 'image/jpeg' && file.size > 131072 ? '?preview=1' : '');

  const action = 'inline-flex items-center justify-center gap-2 rounded-md border border-white/25 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-red-300 enabled:cursor-pointer enabled:hover:border-red-300 enabled:hover:bg-[#8B0000] disabled:opacity-30';

  return <section ref={container} id="historias-conteudo" tabIndex={-1} aria-label="Histórias contadas"
    className="flex min-h-[calc(100svh-3.5rem)] scroll-mt-14 flex-col bg-neutral-950 text-white outline-none fullscreen:h-[100dvh] fullscreen:min-h-0 fullscreen:overflow-y-auto md:h-[calc(100svh-4rem)] md:min-h-0 md:scroll-mt-16 md:overflow-hidden">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-4 sm:px-8">
      <h1 className="text-3xl sm:text-4xl">Histórias contadas</h1>
      <div className="flex flex-wrap gap-2">
        {current && <button className={action} onClick={() => {
          if (fullscreen) void document.exitFullscreen().catch(() => {});
          else void container.current?.requestFullscreen?.().catch(() => {});
        }}>{fullscreen ? <Minimize size={16}/> : <Maximize size={16}/>} {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button>}
        {onClose && <button className={action} onClick={closeGallery}><ArrowLeft size={16}/> Apresentação</button>}
      </div>
    </header>
    <div className={current ? 'grid min-h-0 flex-1 md:grid-rows-[minmax(0,1fr)] ' + (sidebarOpen ? 'md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]') : "min-h-0 flex-1 overflow-y-auto"}>
      <aside id="story-records" hidden={Boolean(current) && !sidebarOpen} aria-label="Escolher história e registros" className={current ? "min-h-0 min-w-0 border-b border-white/15 bg-neutral-900 p-5 md:overflow-y-auto md:border-b-0 md:border-r" : "mx-auto w-full min-w-0 max-w-7xl p-6 sm:p-10"}>
        {current ? <>
          <button onClick={() => chooseStory('')} className={action}><ArrowLeft size={16}/> Todas as histórias</button>
          <h2 ref={storyTitle} tabIndex={-1} className="mt-5 break-words text-2xl outline-none">{current.title}</h2>
          <p className="mb-5 mt-2 text-sm text-white/60">Escolha uma foto, um vídeo ou um áudio.</p>
          <div aria-label="Registros da história" className="max-h-72 space-y-5 overflow-y-auto p-1 md:max-h-none md:overflow-visible">
            {Array.from(dates, ([date, entries]) => <section key={date} aria-label={date ? date.split('-').reverse().join('/') : 'Sem data'}>
              <h3 className="mb-3 flex items-center justify-between border-b border-white/15 pb-2 text-base">
                <span>{date ? <time dateTime={date}>{date.split('-').reverse().join('/')}</time> : 'Sem data'}</span>
                <span className="font-sans text-sm text-white/50">{entries.length}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
            {entries.map(({ file, position }) => <button key={file.id} aria-pressed={index === position}
              aria-label={mediaLabel(file) + ' ' + (position + 1)}
              aria-describedby={popup?.file.id === file.id ? 'record-details-popup' : undefined}
              onPointerEnter={event => { if (event.pointerType !== 'touch') showDetails(file, event.currentTarget); }}
              onPointerLeave={() => setPopup(null)}
              onFocus={event => showDetails(file, event.currentTarget)}
              onBlur={() => setPopup(null)}
              onClick={() => { setIndex(position); setFailed(''); }}
              className={'group relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-md border-2 transition-colors focus-visible:outline-2 focus-visible:outline-red-300 ' +
                (index === position ? 'border-red-400 bg-[#421519]' : 'border-transparent bg-neutral-800 hover:border-red-300 hover:bg-neutral-700')}>
              {file.type.startsWith('image/') ? <img loading="lazy" decoding="async" alt="" src={previewUrl(file)}
                onError={event => { if (event.currentTarget.src.endsWith('?preview=1')) event.currentTarget.src = '/api/stories/' + file.id + '/media'; }}
                className="size-full object-cover transition-opacity group-hover:opacity-80"/> : file.type.startsWith('audio/') ? <Music2 aria-hidden="true" size={28}/> : <Film aria-hidden="true" size={28}/>}
              <span className="absolute bottom-1 left-1 rounded bg-black/80 px-2 py-1 text-xs">{mediaLabel(file)} {position + 1}</span>
            </button>)}
              </div>
            </section>)}
          </div>
        </> : <>
          <h2 className="text-2xl">Histórias da comunidade</h2>
          <p className="mb-5 mt-2 text-sm text-white/60">Escolha uma história para conhecer seus registros.</p>
          {loading && <p role="status">Carregando histórias…</p>}
          {error && <p role="alert">{error} <button className="mt-3 block underline hover:text-red-300" onClick={load}>Tentar novamente</button></p>}
          {!loading && !error && !files.length && <p className="text-white/65">As histórias chegam em breve.</p>}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from(groups, ([id, title]) => {
              const group = files.filter(file => file.collection === id);
              const cover = group.find(file => file.type.startsWith('image/'));
              const videos = group.filter(file => file.type.startsWith('video/')).length;
              const photos = group.filter(file => file.type.startsWith('image/')).length;
              const audios = group.filter(file => file.type.startsWith('audio/')).length;
              const counts = [photos ? photos + (photos === 1 ? ' foto' : ' fotos') : '', videos ? videos + (videos === 1 ? ' vídeo' : ' vídeos') : '', audios ? audios + (audios === 1 ? ' áudio' : ' áudios') : ''].filter(Boolean).join(' · ');
              return <button key={id} ref={element => {
                if (element) cardButtons.current.set(id, element);
                else cardButtons.current.delete(id);
              }} onClick={() => chooseStory(id)}
                className="group cursor-pointer overflow-hidden rounded-lg border border-white/15 bg-neutral-950 text-left transition-colors hover:border-red-400 hover:bg-[#351014] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
                <span className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[#421519]">
                  {cover ? <img loading="lazy" decoding="async" alt="" src={previewUrl(cover)}
                    onError={event => { if (event.currentTarget.src.endsWith('?preview=1')) event.currentTarget.src = '/api/stories/' + cover.id + '/media'; }}
                    className="size-full object-cover transition-transform motion-safe:group-hover:scale-105"/> : audios && !videos ? <Music2 size={36} aria-hidden="true"/> : <BookOpen size={36} aria-hidden="true"/>}
                  {videos > 0 && <Play aria-hidden="true" className="absolute bottom-3 right-3 rounded-full bg-black/75 p-2" size={36}/>}
                </span>
                <span className="block p-4"><span className="font-display block break-words text-2xl">{title}</span><span className="mt-2 block text-sm text-white/60">{counts}</span></span>
              </button>;
            })}
          </div>
        </>}
      </aside>
      {current && <div aria-label="Visualizador de fotos, vídeos e áudios" className="flex min-h-[55svh] min-w-0 flex-col bg-black md:min-h-0">
        {current ? <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
            <button className={action} aria-expanded={sidebarOpen} aria-controls="story-records" onClick={() => { setPopup(null); setSidebarOpen(open => !open); }}>
              {sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}
              {sidebarOpen ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
            </button>
            <div aria-live="polite" className="min-w-0 text-sm text-white/65">
              <p>{mediaLabel(current)} {index + 1} de {items.length}</p>
              <p className="break-words text-white/90">{[current.author, current.recorded_on?.split('-').reverse().join('/')].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex gap-2">
              <button disabled={!index} className={action} onClick={() => { setIndex(index - 1); setFailed(''); }}><ChevronLeft size={17}/> Anterior</button>
              <button disabled={index + 1 === items.length} className={action} onClick={() => { setIndex(index + 1); setFailed(''); }}>Próximo <ChevronRight size={17}/></button>
            </div>
          </div>
          <div className="relative h-[52svh] min-h-0 overflow-hidden md:h-[calc(100svh-13rem)]">
            {loaded !== current.id && failed !== current.id && <p role="status" className="absolute text-sm text-white/65">Carregando registro…</p>}
            {failed === current.id ? <p role="alert" className="p-5 text-center">Não foi possível abrir este registro. <a className="mt-3 block underline hover:text-red-300" href={url} download={current.name}>Baixar arquivo</a></p>
              : current.type.startsWith('audio/') ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
                <Music2 size={48} className="text-red-300" aria-hidden="true"/>
                <p className="max-w-lg text-center font-display text-2xl">{current.title}</p>
                <audio key={current.id} controls preload="metadata" aria-label={'Áudio de ' + current.title} src={url}
                  onLoadedData={() => setLoaded(current.id)} onError={() => setFailed(current.id)} className="w-full max-w-lg"/>
              </div> : current.type.startsWith('video/') ? <video key={current.id} controls playsInline preload="metadata" aria-label={'Vídeo de ' + current.title}
                src={url} onLoadedData={() => setLoaded(current.id)} onError={() => setFailed(current.id)} className="absolute inset-0 size-full object-contain p-3 md:p-6"/>
              : <img key={current.id} alt={'Registro de ' + current.title} src={url} onLoad={() => setLoaded(current.id)} onError={() => setFailed(current.id)}
                className="absolute inset-0 size-full object-contain p-3 md:p-6"/>}
          </div>
        </> : null}
      </div>}
    </div>
    {popup && <div id="record-details-popup" role="tooltip"
      style={{ left: popup.left, top: popup.top, width: 'min(240px, calc(100vw - 24px))' }}
      className="pointer-events-none fixed z-50 space-y-2 rounded-lg border border-white/25 bg-neutral-950 p-4 text-sm text-white shadow-2xl">
      {popup.file.author && <p className="break-words"><span className="block text-xs text-white/50">Autor</span>{popup.file.author}</p>}
      {popup.file.recorded_on && <p><span className="block text-xs text-white/50">Data do registro</span><time dateTime={popup.file.recorded_on}>{popup.file.recorded_on.split('-').reverse().join('/')}</time></p>}
    </div>}
  </section>;
}
