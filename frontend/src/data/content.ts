import { NavItem } from "../types";

export const NAVIGATION_ITEMS: NavItem[] = [
  { id: "inicio", label: "Início", href: "#inicio" },
  {
    id: "visitas",
    label: "Visitas virtuais",
    href: "#visitas",
    description:
      "Explore a aldeia, salas de aula vivas na floresta e trilhas ecológicas em tours 360° interativos.",
  },
  {
    id: "escola",
    label: "Memórias da Escola",
    href: "/memorias-da-escola",
    description:
      "Histórico da educação escolar indígena, arquivos de fotos antigas e depoimentos dos primeiros professores.",
  },
  {
    id: "historias",
    label: "Memórias em histórias contadas",
    href: "/historias-contadas",
    description:
      "Narrativas orais dos anciãos, lendas dos povos originários e saberes dos pajés gravados pela comunidade.",
  },
  {
    id: "manual",
    label: "Manual de conduta para visitantes",
    href: "#manual-conduta",
    description:
      "Diretrizes éticas, respeito à cultura local, regras para fotografias e preservação ambiental.",
  },
  {
    id: "contato",
    label: "Contato",
    href: "#contato",
    description:
      "Agendamento de visitas pedagógicas, parcerias institucionais e canais diretos de comunicação.",
  },
  {
    id: "sobre",
    label: "Sobre o site",
    href: "/sobre",
    description:
      "Projeto de extensão e salvaguarda do patrimônio imaterial da comunidade e sua escola.",
  },
];

export const FRAME_TEXTS = {
  section1: {
    title: "Nossa história, nosso território",
    paragraph:
      "Nossa memória vive nas histórias, nos saberes e na relação com o território. Este espaço reúne registros da Escola Segsõ Tánh Sá e da comunidade Kaingang para aproximar gerações e compartilhar conhecimentos. Conheça nossas histórias e percorra os espaços da escola e da aldeia pela visita virtual.",
    culturalTitle: "Saberes da Terra e Ancestralidade",
    culturalParagraph:
      "O cultivo das espécies nativas e o aprendizado prático ao ar livre formam a base da nossa educação comunitária. Com os anciãos e professoras indígenas, os jovens aprendem a reconhecer sementes, cuidar da botânica sagrada e perpetuar a agroecologia tradicional para as futuras gerações.",
  },
  section2: {
    title: "Memórias que seguimos construindo",
    paragraph:
      "Cada encontro, atividade e celebração faz parte da história da nossa escola. Fotografias, vídeos e relatos ajudam a lembrar quem veio antes e a registrar o que vivemos hoje. Ao reunir essas memórias, queremos que as próximas gerações conheçam os caminhos da comunidade e também contem suas próprias histórias.",
    culturalTitle: "Cultura Viva e Cantos Tradicionais",
    culturalParagraph:
      "A transmissão oral, os grafismos corporais com urucum e jenipapo, os cânticos cerimoniais e as danças sagradas celebram a identidade viva de nosso povo. Na escola da comunidade, cada celebração fortalece a autonomia, a memória e o orgulho de nossa juventude.",
  },
};

export const FOOTER_LINKS = [
  { label: "About Us", ptLabel: "Sobre Nós", href: "#sobre" },
  { label: "Programs", ptLabel: "Programas Educacionais", href: "#visitas" },
  { label: "Events", ptLabel: "Eventos Culturais", href: "#memorias-escola" },
  { label: "Blog", ptLabel: "Notícias & Blog", href: "#historias-contadas" },
  { label: "Join Our Team", ptLabel: "Faça Parte da Equipe", href: "#contato" },
];

export const FOOTER_INFO = {
  phone: "(845)-356-1234",
  addressLine1: "285 Hungry Hallow Road",
  addressLine2: "Chestnut Ridge, NY 10977",
  altAddress: "Aldeia Ywy Porã - Estrada Parque Ambiental, km 14",
  copyright: "© 2026 The Nature Place Day Camp. All Right Reserved",
  credits: {
    privacy: "Privacy Policy",
    studio: "Website By 829 Studios",
  },
};
