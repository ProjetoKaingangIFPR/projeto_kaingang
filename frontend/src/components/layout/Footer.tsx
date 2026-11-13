import React from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { NAVIGATION_ITEMS } from "../../data/content";

interface FooterProps {
  onSelectNav: (id: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectNav }) => {
  return (
    <footer
      id="contato"
      className="w-full bg-[#000000] text-neutral-300 border-t border-neutral-900 scroll-mt-14 md:scroll-mt-16"
      aria-label="Rodapé"
    >
      {/* Upper Footer com Revelação Suave ao Scroll */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 lg:px-14 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12"
        >
          {/* Coluna 1: Identidade & Marca (6 colunas no desktop) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 px-2 py-1 rounded-[3px] flex items-center">
                <img
                  src="/images/logo.svg"
                  alt="Memórias da Escola Indígena"
                  className="h-6 sm:h-7 w-auto select-none"
                />
              </div>
              <span className="text-white font-bold text-sm sm:text-base lg:text-lg tracking-tight">
                Memórias da Escola Indígena
              </span>
            </div>
            <p className="text-xs sm:text-[13px] 2xl:text-sm text-neutral-400 leading-relaxed max-w-md">
              Espaço comunitário de documentação da história escolar indígena,
              salvaguarda dos saberes ancestrais, catalogação etnobotânica e
              memórias vivas da comunidade.
            </p>
            <div className="pt-2 text-xs 2xl:text-sm text-neutral-400 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E51E2B] shrink-0" />
              <span>Terra Indígena · Educação Escolar Diferenciada</span>
            </div>
          </div>

          {/* Coluna 2: Navegação do Site (3 colunas no desktop) */}
          <div className="lg:col-span-3 space-y-3 lg:pl-4">
            <h3 className="text-[11px] sm:text-xs 2xl:text-[13px] uppercase tracking-wider font-bold text-white">
              Navegação do Site
            </h3>
            <ul className="space-y-2 text-xs sm:text-[13.5px] 2xl:text-sm">
              {NAVIGATION_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectNav(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 -ml-3 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all text-left cursor-pointer rounded-[3px]"
                  >
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3: Acervo Comunitário (3 colunas no desktop) */}
          <div className="lg:col-span-3 space-y-3 lg:pl-4">
            <h3 className="text-[11px] sm:text-xs 2xl:text-[13px] uppercase tracking-wider font-bold text-white">
              Acervo Comunitário
            </h3>
            <ul className="space-y-2 text-xs sm:text-[13.5px] 2xl:text-sm text-neutral-400">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectNav("visitas")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 -ml-3 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer text-left rounded-[3px]"
                >
                  Visitas Pedagógicas
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectNav("historias")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 -ml-3 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer text-left rounded-[3px]"
                >
                  Tradição Oral
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectNav("manual")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 -ml-3 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer text-left rounded-[3px]"
                >
                  Manual de Conduta
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectNav("sobre")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 -ml-3 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer text-left rounded-[3px]"
                >
                  Sobre o Projeto
                </button>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Sub-footer Inferior */}
      <div className="border-t border-neutral-900 bg-[#080808] py-5 px-4 sm:px-8 text-[11px] sm:text-xs 2xl:text-[13px] text-neutral-500">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            © {new Date().getFullYear()} Memórias da Escola Indígena. Todos os
            direitos reservados à comunidade.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectNav("manual")}
              className="px-3 py-1 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer rounded-[3px]"
            >
              Manual de Conduta
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => onSelectNav("sobre")}
              className="px-3 py-1 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer rounded-[3px]"
            >
              Sobre o Projeto
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
