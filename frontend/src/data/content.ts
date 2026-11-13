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
    href: "#memorias-escola",
    description:
      "Histórico da educação escolar indígena, arquivos de fotos antigas e depoimentos dos primeiros professores.",
  },
  {
    id: "historias",
    label: "Memórias em histórias contadas",
    href: "#historias-contadas",
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
    href: "#sobre",
    description:
      "Projeto de extensão e salvaguarda do patrimônio imaterial da comunidade e sua escola.",
  },
];

export const FRAME_TEXTS = {
  section1: {
    title: "teste enim",
    paragraph:
      "Lorem ipsum dolor sit amet asda consectetur. Id dictumst nisi lacus urna pellentesque elit suspendisse. Sed egestas sollicitudin praesent a in. Neque turpis at arcu mauris purus sed nec tortor. Quisque quisque auctor feugiat maecenas elit dictum orci aliquam.",
    culturalTitle: "Saberes da Terra e Ancestralidade",
    culturalParagraph:
      "O cultivo das espécies nativas e o aprendizado prático ao ar livre formam a base da nossa educação comunitária. Com os anciãos e professoras indígenas, os jovens aprendem a reconhecer sementes, cuidar da botânica sagrada e perpetuar a agroecologia tradicional para as futuras gerações.",
  },
  section2: {
    title: "teste enim",
    paragraph:
      "Lorem ipsum dolor sit amet asda consectetur. Id dictumst nisi lacus urna pellentesque elit suspendisse. Sed egestas sollicitudin praesent a in. Neque turpis at arcu mauris purus sed nec tortor. Quisque quisque auctor feugiat maecenas elit dictum orci aliquam.",
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
