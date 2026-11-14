export function AboutSection() {
  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="scroll-mt-20 bg-neutral-950 px-6 py-16 text-white sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-400">Sobre o site</p>
        <h1 id="sobre-titulo" className="max-w-3xl text-2xl font-semibold leading-tight sm:text-4xl">
          Projeto de Extensão “Centro de Memória Kaingang”
        </h1>
        <p className="mt-4 text-lg text-white/70">IFPR – Campus Palmas</p>
        <div className="mt-10 grid gap-8 border-t border-white/15 pt-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-lg font-semibold">Autores</h3>
            <ul className="space-y-2 text-white/80">
              <li>Cassieli Santos Viri</li>
              <li>Maria Eduarda Fagundes Amantino</li>
              <li>Yasmin Mendes Viri Rêféj</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-lg font-semibold">Coautores</h3>
            <ul className="space-y-2 text-white/80">
              <li>Magda Vicini</li>
              <li>Claudecir Viri</li>
            </ul>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-3 text-lg font-semibold">Bolsistas do projeto</h3>
            <ul className="space-y-3 text-white/80">
              <li>Keyse Lilian Steffen <span className="text-white/55">(Artes Visuais)</span></li>
              <li>Elias Mathias Sand <span className="text-white/55">(Sistemas de Informação)</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
