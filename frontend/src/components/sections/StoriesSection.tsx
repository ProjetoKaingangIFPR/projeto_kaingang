import { ArrowDown } from "lucide-react";

export function StoriesSection() {
  const scrollToStories = () => {
    const target = document.getElementById("historias-conteudo");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };

  return (
    <>
      <section
        id="historias-contadas"
        aria-labelledby="historias-titulo"
        className="flex min-h-[calc(100svh-4rem)] items-center bg-neutral-950 px-6 py-16 text-white sm:py-24"
      >
        <div className="mx-auto w-full max-w-5xl">
          <h1
            id="historias-titulo"
            className="max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl"
          >
            Memórias em histórias contadas
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-white/80 sm:text-xl sm:leading-relaxed">
            Realizamos este trabalho para guardar pesquisas, histórias e como era a
            vida dos nossos antepassados e para mostrar para os mais pequenos de
            como era a vida do povo Kaingang. Também para relembrar histórias do
            passado, com era a rotina dos Kaingangs antigamente, como já
            pesquisamos mais além, descobrimos umas coisas bem legais de como foi
            naquele tempo.
          </p>
          <button
            type="button"
            onClick={scrollToStories}
            aria-controls="historias-conteudo"
            className="mt-10 inline-flex cursor-pointer items-center justify-center gap-3 rounded-[3px] bg-[#8B0000] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#a30000] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Rolar para baixo
            <ArrowDown aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Espaço reservado para o conteúdo que será fornecido depois. */}
      <section
        id="historias-conteudo"
        aria-label="Conteúdo das histórias"
        tabIndex={-1}
        className="min-h-[70svh] scroll-mt-14 bg-neutral-900 outline-none md:scroll-mt-16"
      />
    </>
  );
}
