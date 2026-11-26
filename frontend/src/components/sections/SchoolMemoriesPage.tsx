import { CulturalWeeks } from './CulturalWeeks';

const curriculum = [
  { title: 'Língua Indígena (Kaingang)', items: [
    ['Como funciona', 'É um componente obrigatório em toda a Educação Básica (do Ensino Fundamental ao Médio).'],
    ['Foco', 'Garante a alfabetização bilíngue e a manutenção do idioma materno na modalidade oral e escrita. São dedicadas cerca de 6 aulas semanais a este aprendizado.'],
  ] },
  { title: 'Saberes Ancestrais e Identitários', items: [
    ['Filosofia Indígena', 'Introduzida para debater a cosmovisão e as formas de pensamento dos povos originários.'],
    ['Cultura Corporal Indígena', 'Voltada a práticas corporais, jogos tradicionais e danças que fazem parte dos rituais do povo Kaingang.'],
    ['Arte Indígena', 'Focada no artesanato, pintura corporal e grafismos tradicionais, integrando o conhecimento técnico e histórico dos anciãos.'],
  ] },
  { title: 'Formação Humana e Cidadania', items: [
    ['Projeto de Vida e Bem Viver', 'Uma adaptação do modelo tradicional de “Projeto de Vida”, focando no conceito indígena do “bem viver” em comunidade, na relação sustentável com o território e no fortalecimento das lideranças locais.'],
  ] },
  { title: 'Tecnologia e Produção Local', items: [
    ['Informática Básica e Robótica', 'Aplicada ao contexto escolar contemporâneo.'],
    ['Laboratório de Escrita e Produção Audiovisual', 'Disciplina voltada para que os próprios jovens indígenas dominem ferramentas digitais e usem mídias (como vídeos e áudios) para registrar e divulgar a própria história.'],
  ] },
];
const facts = [
  ['Localização', 'Posto Indígena FUNAI, Área Rural — Palmas, PR.'],
  ['Rede de Ensino', 'Pública Estadual (Governo do Paraná).'],
  ['Modalidade', 'Educação Escolar Indígena, oferecendo atendimento voltado à preservação da cultura, língua e tradições da comunidade local, integrada ao ensino regular.'],
  ['Níveis de Ensino', 'Educação Infantil, Anos Iniciais e Finais do Ensino Fundamental, e Ensino Médio.'],
];

export function SchoolMemoriesPage() {
  return <article className="bg-neutral-950 text-white">
    <header className="border-b border-white/15 px-6 py-14 sm:px-10 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h1 className="max-w-3xl text-4xl leading-tight sm:text-6xl">Memórias da Escola</h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-white/75">O Colégio Estadual Indígena Ségsó Tanh Sa (frequentemente referido como Segso Tanh Sa) fica localizado na área rural de Palmas, Paraná, especificamente na região do Posto Indígena da FUNAI.</p>
        <nav aria-label="Nesta página" className="mt-8 flex flex-wrap gap-3 text-sm">
          {[['dados-escola', 'Conheça o colégio'], ['curriculo-escola', 'Educação e cultura'], ['semanas-culturais', 'Álbuns dos eventos da escola']].map(([id, label]) =>
            <a key={id} href={'#' + id} className="rounded border border-white/25 px-4 py-3 transition-colors hover:border-red-300 hover:bg-[#730000]">{label}</a>)}
        </nav>
      </div>
    </header>
    <section id="dados-escola" aria-labelledby="dados-titulo" className="scroll-mt-20 px-6 py-12 sm:px-10 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <h2 id="dados-titulo" className="text-3xl">Dados principais</h2>
        <dl className="divide-y divide-white/15">{facts.map(([label, text]) => <div key={label} className="py-5 first:pt-0">
          <dt className="mb-2 font-semibold text-red-200">{label}</dt>
          <dd className="leading-relaxed text-white/75">{text}</dd>
        </div>)}</dl>
      </div>
    </section>
    <section id="curriculo-escola" aria-labelledby="curriculo-titulo" className="scroll-mt-20 border-t border-white/15 px-6 py-12 sm:px-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="curriculo-titulo" className="text-3xl sm:text-4xl">Educação, cultura e território</h2>
        <p className="mt-6 max-w-4xl leading-relaxed text-white/75">A matriz curricular do Colégio Estadual Indígena Ségsó Tánh Sá segue as diretrizes da Secretaria da Educação do Paraná (SEED-PR) para a Educação Escolar Indígena. Isso significa que, além das matérias da Base Nacional Comum Curricular (como Matemática, Biologia e Geografia), os alunos têm componentes curriculares específicos voltados à identidade, cultura e território do povo Kaingang.</p>
        <p className="mt-4 text-white/75">As disciplinas específicas integradas à grade incluem:</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {curriculum.map(subject => <section key={subject.title} className="rounded-lg border border-white/15 bg-neutral-900 p-6">
            <h3 className="mb-5 text-2xl text-white">{subject.title}</h3>
            <dl className="space-y-5">{subject.items.map(([label, text]) => <div key={label}>
              <dt className="mb-1 font-semibold text-red-200">{label}</dt>
              <dd className="leading-relaxed text-white/70">{text}</dd>
            </div>)}</dl>
          </section>)}
        </div>
      </div>
    </section>
    <CulturalWeeks />
  </article>;
}
