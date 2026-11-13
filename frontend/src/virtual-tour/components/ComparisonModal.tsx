import React from 'react';
import { 
  CheckCircle2, 
  Map, 
  Navigation, 
  Zap, 
  Cpu, 
  Compass, 
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';

interface ComparisonModalProps {
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ onClose }) => {
  return (
    <div
      id="comparison-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="comparison-modal-content"
        className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 text-neutral-900 shadow-2xl border border-neutral-200 space-y-6 my-8 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-bold uppercase tracking-wider mb-2 font-mono-data">
              <Zap className="w-3.5 h-3.5" /> Análise Técnica & Usabilidade
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight font-display">
              Navegação Tradicional (Street View) vs Planta Baixa Interativa
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Comparativo de facilidade técnica, experiência do visitante e como combinamos ambas no projeto.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-black p-2 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Verdict Box */}
        <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-black">
            <Sparkles className="w-4 h-4 text-black" />
            Veredito de Engenharia: Qual é mais simples de fazer?
          </div>
          <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
            <strong className="text-black">A Planta Baixa Interativa é mais simples e direta de desenvolver</strong>, pois opera no espaço 2D (coordenadas de clique no Canvas). No entanto, <strong className="text-black">ao desenhar a planta com os pontos, você ganha a navegação tradicional automaticamente</strong>: com as coordenadas (x, y) de cada ponto, o sistema calcula o ângulo exato para projetar as setas 3D no chão do 360° sem esforço extra!
          </p>
        </div>

        {/* 2-Column Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Planta Baixa Interativa */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-black font-bold text-base font-display">
              <Map className="w-5 h-5" />
              1. Planta Baixa Interativa
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Vantagens de Usabilidade:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-neutral-600">
                <li><strong className="text-neutral-900">Orientação espacial completa:</strong> O visitante nunca se perde; vê o museu inteiro de relance.</li>
                <li><strong className="text-neutral-900">Salto direto:</strong> Permite ir da entrada ao terraço em 1 clique, sem precisar dar 20 passos virtuais em corredores.</li>
                <li><strong className="text-neutral-900">Radar visual:</strong> O cone de visão indica exatamente para onde sua câmera está apontada.</li>
              </ul>
            </div>

            <div className="space-y-2 text-xs border-t border-neutral-100 pt-3">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-neutral-800" /> Simplicidade Técnica:
              </div>
              <p className="text-neutral-600">
                <strong className="text-neutral-900">Muito Alta (9/10).</strong> Apenas detecção de colisão 2D entre o cursor do mouse e círculos no canvas. Altíssima taxa de quadros e zero complexidade de projeção.
              </p>
            </div>
          </div>

          {/* Card 2: Navegação Tradicional (Street View) */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-black font-bold text-base font-display">
              <Navigation className="w-5 h-5" />
              2. Navegação Tradicional (No Chão)
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-neutral-800" /> Vantagens de Usabilidade:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-neutral-600">
                <li><strong className="text-neutral-900">Imersão em primeira pessoa:</strong> Sensação de caminhar fisicamente pelo espaço passo a passo.</li>
                <li><strong className="text-neutral-900">Intuitivo:</strong> Todo usuário já usou o Google Street View e entende setas no chão instantaneamente.</li>
                <li><strong className="text-neutral-900">Sem tela dividida:</strong> Foco 100% no visual 360° em tela cheia.</li>
              </ul>
            </div>

            <div className="space-y-2 text-xs border-t border-neutral-100 pt-3">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-neutral-800" /> Simplicidade Técnica:
              </div>
              <p className="text-neutral-600">
                <strong className="text-neutral-900">Média (6/10).</strong> Requer matrizes 3D, projeção de retículas no chão e cálculo de trigonometria esférica (Yaw/Pitch) entre os pontos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Solution Note */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-neutral-500 font-mono-data">
            Arquitetura Híbrida 360° + Minimapa 2D
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs transition-colors uppercase tracking-wider shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
