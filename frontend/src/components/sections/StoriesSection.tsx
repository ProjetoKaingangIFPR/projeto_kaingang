import { BookOpen } from "lucide-react";
import { StoryGallery } from "./StoryGallery";
import { useEffect, useRef, useState } from "react";

export function StoriesSection() {
  const [viewing, setViewing] = useState(() => window.location.hash.startsWith('#acervo'));
  const entryButton = useRef<HTMLButtonElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setViewing(window.location.hash.startsWith('#acervo'));
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);
  useEffect(() => {
    if (viewing) {
      gallery.current?.focus({ preventScroll: true });
      gallery.current?.scrollIntoView({ block: 'start' });
    }
  }, [viewing]);
  const openStories = () => {
    window.history.pushState({}, '', '#acervo');
    setViewing(true);
  };
  const closeStories = () => {
    window.history.pushState({}, '', window.location.pathname);
    setViewing(false);
    requestAnimationFrame(() => entryButton.current?.focus());
  };

  return (
    <>
      {viewing ? <div ref={gallery} tabIndex={-1} className="scroll-mt-14 outline-none md:scroll-mt-16"><StoryGallery onClose={closeStories} /></div> : (
      <section
        id="historias-contadas"
        aria-labelledby="historias-titulo"
        className="relative flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-neutral-950 text-white md:min-h-[calc(100svh-4rem)]"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-10 sm:px-10 md:grid-cols-[1.15fr_0.85fr] md:gap-14 md:py-14 lg:gap-20 lg:px-16">
        <div>
          <h1
            id="historias-titulo"
            className="max-w-xl text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Memórias em histórias contadas
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg sm:leading-relaxed">
            Realizamos este trabalho para guardar pesquisas, histórias e como era a
            vida dos nossos antepassados e para mostrar para os mais pequenos de
            como era a vida do povo Kaingang. Também para relembrar histórias do
            passado, com era a rotina dos Kaingangs antigamente, como já
            pesquisamos mais além, descobrimos umas coisas bem legais de como foi
            naquele tempo.
          </p>
          <button
            type="button"
            ref={entryButton}
            onClick={openStories}
            className="mt-8 inline-flex w-fit cursor-pointer items-center justify-center gap-3 rounded-[3px] bg-[#8B0000] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#a30000] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Conhecer as histórias
            <BookOpen aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-[39%] md:max-w-none">
          <img src="/images/mulher-planta.jpeg" alt="Mulher observando as folhas de uma planta." fetchPriority="high"
            className="size-full object-cover object-center"/>
        </div>
        </div>
      </section>
      )}
    </>
  );
}
