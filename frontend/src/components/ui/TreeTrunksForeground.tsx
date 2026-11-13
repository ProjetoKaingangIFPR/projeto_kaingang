import React from "react";
import { motion, MotionValue } from "framer-motion";

interface TreeTrunksForegroundProps {
  xLeft: MotionValue<string> | MotionValue<number>;
  xRight: MotionValue<string> | MotionValue<number>;
  yLeft: MotionValue<number>;
  yRight: MotionValue<number>;
  scaleLeft: MotionValue<number>;
  scaleRight: MotionValue<number>;
}

export const TreeTrunksForeground: React.FC<TreeTrunksForegroundProps> = ({
  xLeft,
  xRight,
  yLeft,
  yRight,
  scaleLeft,
  scaleRight,
}) => {
  return (
    <div
      className="hidden sm:block absolute inset-0 pointer-events-none z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 
        Tronco da Esquerda:
        - sm (640px): -left-72 (-288px) -> tela mais apertada, árvore mais para fora
        - md (768px): md:-left-52 (-208px) -> tela média, entra proporcionalmente
        - lg (1024px): lg:-left-20 (-80px) -> desktop, portal visível
        - xl (1280px): xl:left-0 -> tela cheia, posição natural
      */}
      <motion.div
        className="absolute -top-[8%] sm:-left-72 md:-left-52 lg:-left-20 xl:left-0 h-[116%] w-auto pointer-events-none will-change-transform origin-left"
        style={{
          x: xLeft,
          y: yLeft,
          scale: scaleLeft,
        }}
      >
        <img
          src="/images/tronco_2.png"
          alt=""
          className="h-full w-auto max-w-none object-contain pointer-events-none filter drop-shadow-[14px_0_25px_rgba(0,0,0,0.65)] contrast-105 brightness-95 select-none"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </motion.div>

      {/* 
        Tronco da Direita (imagem mais larga, recuos ajustados para simetria):
        - sm (640px): sm:-right-80 (-320px) -> tela apertada, tronco mais para fora
        - md (768px): md:-right-60 (-240px) -> entra em harmonia com a esquerda
        - lg (1024px): lg:-right-24 (-96px) -> portal visível
        - xl (1280px): xl:right-0 -> tela cheia, posição natural
      */}
      <motion.div
        className="absolute -top-[8%] sm:-right-80 md:-right-60 lg:-right-24 xl:right-0 h-[116%] w-auto pointer-events-none will-change-transform origin-right"
        style={{
          x: xRight,
          y: yRight,
          scale: scaleRight,
        }}
      >
        <img
          src="/images/tronco_1.png"
          alt=""
          className="h-full w-auto max-w-none object-contain pointer-events-none filter drop-shadow-[-14px_0_25px_rgba(0,0,0,0.65)] contrast-105 brightness-95 select-none"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </motion.div>
    </div>
  );
};
