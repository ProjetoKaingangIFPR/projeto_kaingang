import { TourData } from '../types';

export const DEFAULT_TOUR: TourData = {
  id: 'arts_culture_museum',
  title: 'Museu de Belas Artes & Pavilhão das Artes',
  description: 'Visita virtual imersiva 360° com navegação por planta baixa interativa e pontos de interesse inspirados no Google Arts & Culture.',
  floorPlan: {
    width: 800,
    height: 520,
    scale: 30, // 30 px = 1 meter
    walls: [
      // Outer perimeter walls
      { id: 'w1', start: { x: 80, y: 60 }, end: { x: 720, y: 60 }, thickness: 8, type: 'wall' },
      { id: 'w2', start: { x: 720, y: 60 }, end: { x: 720, y: 460 }, thickness: 8, type: 'wall' },
      { id: 'w3', start: { x: 720, y: 460 }, end: { x: 80, y: 460 }, thickness: 8, type: 'wall' },
      { id: 'w4', start: { x: 80, y: 460 }, end: { x: 80, y: 60 }, thickness: 8, type: 'wall' },

      // Divider between West Wing (Galeria Clássica & Biblioteca) and Center (Rotunda & Pátio)
      { id: 'w5', start: { x: 280, y: 60 }, end: { x: 280, y: 220 }, thickness: 6, type: 'wall' },
      { id: 'w6', start: { x: 280, y: 280 }, end: { x: 280, y: 460 }, thickness: 6, type: 'wall' },

      // Divider between North-West (Galeria) and South-West (Biblioteca)
      { id: 'w7', start: { x: 80, y: 260 }, end: { x: 220, y: 260 }, thickness: 6, type: 'wall' },

      // Divider between Center (Rotunda/Pátio) and East Wing (Pavilhão Moderno)
      { id: 'w8', start: { x: 520, y: 60 }, end: { x: 520, y: 200 }, thickness: 6, type: 'wall' },
      { id: 'w9', start: { x: 520, y: 260 }, end: { x: 520, y: 460 }, thickness: 6, type: 'wall' },

      // Divider between North Center (Rotunda) and South Center (Pátio)
      { id: 'w10', start: { x: 280, y: 260 }, end: { x: 360, y: 260 }, thickness: 6, type: 'wall' },
      { id: 'w11', start: { x: 440, y: 260 }, end: { x: 520, y: 260 }, thickness: 6, type: 'wall' },
    ],
    rooms: [
      {
        id: 'room_classic',
        name: 'Galeria Clássica',
        color: '#d97706',
        bounds: { x: 80, y: 60, width: 200, height: 200 },
        floorType: 'parquet',
        roomPointId: 'p2'
      },
      {
        id: 'room_library',
        name: 'Salão da Biblioteca',
        color: '#b91c1c',
        bounds: { x: 80, y: 260, width: 200, height: 200 },
        floorType: 'carpet',
        roomPointId: 'p4'
      },
      {
        id: 'room_atrium',
        name: 'Grande Átrio & Rotunda',
        color: '#0284c7',
        bounds: { x: 280, y: 60, width: 240, height: 200 },
        floorType: 'marble',
        roomPointId: 'p1'
      },
      {
        id: 'room_courtyard',
        name: 'Pátio de Esculturas',
        color: '#059669',
        bounds: { x: 280, y: 260, width: 240, height: 200 },
        floorType: 'garden',
        roomPointId: 'p5'
      },
      {
        id: 'room_modern',
        name: 'Pavilhão Contemporâneo',
        color: '#6366f1',
        bounds: { x: 520, y: 60, width: 200, height: 400 },
        floorType: 'concrete',
        roomPointId: 'p3'
      }
    ]
  },
  startingPointId: 'p1',
  points: [
    {
      id: 'p1',
      name: 'Grande Átrio & Rotunda Principal',
      roomName: 'Átrio Central',
      description: 'Ponto de entrada monumental com iluminação zenital difusa, pé-direito duplo e arquitetura neoclássica.',
      x: 400,
      y: 160,
      initialYaw: 0,
      panoramaUrl: 'grand_atrium',
      color: '#38bdf8',
      connectedPointIds: ['p2', 'p3', 'p5'],
      hotspots: [
        {
          id: 'h1_1',
          title: 'Cúpula Envividraçada de Luz Zenital',
          artist: 'Arquitetura Monumental',
          year: '1904',
          description: 'Estrutura metálica com vidros que filtram a luz solar natural para preservar as obras expostas no piso térreo.',
          yaw: 0.1,
          pitch: 0.45
        },
        {
          id: 'h1_2',
          title: 'Monólito de Bronze "O Pensamento Livre"',
          artist: 'Escultor Auguste M.',
          year: '1912',
          description: 'Peça central fundida em bronze patinado que recepciona os visitantes do museu.',
          yaw: 3.1,
          pitch: -0.22
        }
      ]
    },
    {
      id: 'p2',
      name: 'Galeria Clássica Renascentista',
      roomName: 'Ala Noroeste',
      description: 'Salão com piso de parquet francês, sancas em gesso e obras de mestres dos séculos XVI e XVII.',
      x: 180,
      y: 160,
      initialYaw: 1.57,
      panoramaUrl: 'gallery_classic',
      color: '#fbbf24',
      connectedPointIds: ['p1', 'p4'],
      hotspots: [
        {
          id: 'h2_1',
          title: 'A Dança das Musas Clássicas',
          artist: 'Mestre da Escola Veneziana',
          year: '1584',
          description: 'Óleo sobre tela retratando a celebração mitológica sob um céu de fim de tarde.',
          yaw: -0.45,
          pitch: 0.05
        },
        {
          id: 'h2_2',
          title: 'Retrato de Dama com Colar de Âmbar',
          artist: 'Ateliê dos Mestres',
          year: '1602',
          description: 'Pintura a óleo com iluminação em claro-escuro inspirada em Caravaggio.',
          yaw: 1.25,
          pitch: 0.02
        }
      ]
    },
    {
      id: 'p3',
      name: 'Pavilhão de Arte Contemporânea',
      roomName: 'Ala Leste',
      description: 'Espaço arejado com concreto arquitetônico, claraboias industriais e telas abstratas monumentais.',
      x: 620,
      y: 250,
      initialYaw: -1.57,
      panoramaUrl: 'modern_pavilion',
      color: '#ec4899',
      connectedPointIds: ['p1', 'p5'],
      hotspots: [
        {
          id: 'h3_1',
          title: 'Composição Abstrata em Coalt & Ocre',
          artist: 'Helena Vasconcelos',
          year: '2021',
          description: 'Pintura monumental que investiga o equilíbrio cromático em espaços de concreto aparente.',
          yaw: 0.6,
          pitch: 0.08
        }
      ]
    },
    {
      id: 'p4',
      name: 'Salão Histórico da Biblioteca',
      roomName: 'Ala Sudoeste',
      description: 'Ambiente aconchegante com estantes de mogno do piso ao teto, volumes raros e tapete persa autêntico.',
      x: 180,
      y: 360,
      initialYaw: 0,
      panoramaUrl: 'historic_library',
      color: '#d97706',
      connectedPointIds: ['p2', 'p5'],
      hotspots: [
        {
          id: 'h4_1',
          title: 'Coleção Cartográfica Rara',
          artist: 'Arquivo Histórico do Museu',
          year: '1745',
          description: 'Mapas originais gravados em chapa de cobre com iluminuras à mão.',
          yaw: -1.8,
          pitch: -0.05
        }
      ]
    },
    {
      id: 'p5',
      name: 'Pátio de Esculturas & Jardim de Inverno',
      roomName: 'Átrio Sul',
      description: 'Pátio com pedras travertino, esculturas ao ar livre e conexão visual direta com todas as alas do museu.',
      x: 400,
      y: 360,
      initialYaw: 3.14,
      panoramaUrl: 'sculpture_courtyard',
      color: '#10b981',
      connectedPointIds: ['p1', 'p3', 'p4'],
      hotspots: [
        {
          id: 'h5_1',
          title: 'Jardim de Esculturas em Bronze',
          artist: 'Acervo Permanente',
          year: '1968',
          description: 'Diálogo entre paisagismo botânico e formas tridimensionais orgânicas.',
          yaw: 0.0,
          pitch: -0.15
        }
      ]
    }
  ]
};
