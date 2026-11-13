import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
  title: string;
}

// Descobre os arquivos sem importar as imagens: public é servido pela raiz.
const heroImageModules = import.meta.glob<string>(
  "/public/images/hero/*.{jpg,jpeg,png,webp,avif,svg,JPG,JPEG,PNG,WEBP,SVG}",
  { query: "?url", import: "default" },
);

const DYNAMIC_SLIDES: HeroSlide[] = Object.keys(heroImageModules).map(
  (filePath, index) => {
    const src = filePath.replace(/^\/public/, "");
    const fileName =
      filePath
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || `hero-${index}`;

    return {
      id: `hero-${index}-${fileName}`,
      src,
      alt: `Memórias da Escola Indígena - ${fileName}`,
      title: fileName,
    };
  },
);

// Fallback de segurança caso a pasta esteja vazia
const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "fallback-amostra",
    src: "/images/amostra.jpeg",
    alt: "Memórias da Escola Indígena",
    title: "Memórias Vivas & Tradição",
  },
];

export const HeroSection: React.FC = () => {
  const slides = DYNAMIC_SLIDES.length > 0 ? DYNAMIC_SLIDES : FALLBACK_SLIDES;
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Troca automática entre as imagens a cada 5.5 segundos se houver mais de 1 slide
  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5500);

    return () => clearInterval(interval);
  }, [slides.length]);

  const activeSlide = slides[currentSlideIndex] || slides[0];

  return (
    <section
      id="inicio"
      className="relative w-full flex flex-col justify-between bg-black select-none overflow-hidden h-[calc(100svh-3.5rem)] md:h-[calc(100svh-4rem)] min-h-[460px] max-h-[1140px]"
      aria-label="Apresentação Principal"
    >
      {/* 
        Hero Image Container:
        Ocupa todo o espaço vertical da tela inicial até a barra de navegação,
        garantindo que Hero + Navbar formem exatamente 100svh no primeiro impacto visual.
      */}
      <div className="relative w-full h-full overflow-hidden bg-neutral-950">
        {/* Slideshow 100% Automático com Transição Crossfade e Efeito Ken Burns Suave */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={activeSlide.src}
              alt={activeSlide.alt}
              className="w-full h-full object-cover object-center select-none"
              referrerPolicy="no-referrer"
              loading="eager"
            />
            {/* Vinheta sutil e gradiente de iluminação natural para profundidade */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Top-Left: 3 Barras Pretas Verticais encorpadas e marcantes em todas as telas */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-0 left-3 sm:left-5 md:left-8 lg:left-12 xl:left-16 z-20 pointer-events-none"
        >
          <div
            className="flex items-start gap-2 sm:gap-2.5 md:gap-3 lg:gap-4"
            aria-hidden="true"
          >
            <div className="w-7 sm:w-9 md:w-12 lg:w-14 xl:w-16 h-24 sm:h-32 md:h-40 lg:h-44 xl:h-48 bg-black shadow-2xl" />
            <div className="w-7 sm:w-9 md:w-12 lg:w-14 xl:w-16 h-24 sm:h-32 md:h-40 lg:h-44 xl:h-48 bg-black shadow-2xl" />
            <div className="w-7 sm:w-9 md:w-12 lg:w-14 xl:w-16 h-24 sm:h-32 md:h-40 lg:h-44 xl:h-48 bg-black shadow-2xl" />
          </div>
        </motion.div>

        {/* Right-Side: 3 Círculos Vermelhos na mesma escala robusta */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 z-20 pointer-events-none"
        >
          <div
            className="flex flex-col items-center gap-3 sm:gap-3.5 md:gap-4.5 lg:gap-6"
            aria-hidden="true"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 rounded-full bg-[#E51E2B] shadow-2xl transition-transform hover:scale-105" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 rounded-full bg-[#E51E2B] shadow-2xl transition-transform hover:scale-105" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 rounded-full bg-[#E51E2B] shadow-2xl transition-transform hover:scale-105" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};
