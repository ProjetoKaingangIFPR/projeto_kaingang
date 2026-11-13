import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useImages } from "../../context/ImageContext";
import { FRAME_TEXTS } from "../../data/content";
import { ContentMode } from "../../types";
import { TreeTrunksForeground } from "../ui/TreeTrunksForeground";
import { Compass, BookOpen, ArrowRight } from "lucide-react";

interface NatureSectionProps {
  mode: ContentMode;
  onSelectNav?: (id: string) => void;
}

export const NatureSection: React.FC<NatureSectionProps> = ({
  mode,
  onSelectNav,
}) => {
  const { images } = useImages();
  const content = FRAME_TEXTS.section1;
  const isCultural = mode === "cultural_full";

  const bgImageSrc = images.forestBg || "/images/floresta-bg.jpg";
  const natureImageSrc = images.nature || "/images/mulher-planta.jpeg";

  const sectionRef = useRef<HTMLElement>(null);

  // Scroll Progress para Parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Parallax Abertura / Portal nos troncos em tablets e desktops
  const xLeft = useTransform(
    scrollYProgress,
    [0, 0.35, 0.7, 1],
    ["0%", "-10%", "-25%", "-45%"],
  );
  const xRight = useTransform(
    scrollYProgress,
    [0, 0.35, 0.7, 1],
    ["0%", "10%", "25%", "45%"],
  );
  const yLeft = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 0, 12]);
  const yRight = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 0, 12]);
  const scaleLeft = useTransform(scrollYProgress, [0, 0.5, 1], [0.99, 1, 1.02]);
  const scaleRight = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [0.99, 1, 1.02],
  );

  // Floresta ao fundo acompanhando suavemente em Parallax
  const scaleForest = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [1.02, 1.06, 1.11],
  );
  const yForest = useTransform(scrollYProgress, [0, 0.5, 1], [-25, 0, 30]);

  return (
    <section
      ref={sectionRef}
      id="visitas"
      className="relative w-full overflow-hidden py-14 sm:py-20 md:py-28 lg:py-32 xl:py-36 2xl:py-40 bg-[#101812] scroll-mt-14 md:scroll-mt-16"
      aria-label="Seção Floresta"
    >
      {/* 1. BACKGROUND LAYER: Floresta acompanhando em Parallax */}
      <motion.div
        className="absolute inset-[-10%] z-0 will-change-transform"
        style={{
          scale: scaleForest,
          y: yForest,
        }}
      >
        <img
          src={bgImageSrc}
          alt="Floresta tropical exuberante com copas de árvores"
          className="w-full h-full object-cover object-center filter brightness-100 contrast-105"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      </motion.div>

      {/* 2. FOREGROUND PARALLAX: Troncos de abertura ativados em telas >= 640px */}
      <TreeTrunksForeground
        xLeft={xLeft}
        xRight={xRight}
        yLeft={yLeft}
        yRight={yRight}
        scaleLeft={scaleLeft}
        scaleRight={scaleRight}
      />

      {/* 3. CONTENT LAYER: Card Branco e Foto com Revelação Suave */}
      <div className="relative z-20 max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 2xl:px-20">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-12 xl:gap-16">
          {/* Card Branco com Tipografia Responsiva */}
          <motion.div
            initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl lg:max-w-[580px] xl:max-w-[640px] 2xl:max-w-[700px] bg-white shadow-[0_25px_60px_rgba(0,0,0,0.5)] p-6 sm:p-10 md:p-12 xl:p-14 border border-black/10 rounded-[3px]"
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{
                duration: 0.7,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl xl:text-4xl 2xl:text-5xl font-extrabold text-black tracking-tight leading-tight"
            >
              {isCultural ? content.culturalTitle : content.title}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{
                duration: 0.7,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-4 sm:mt-6 md:mt-8 text-neutral-800 text-sm sm:text-base lg:text-[15.5px] xl:text-[16px] 2xl:text-[17px] leading-relaxed font-normal"
            >
              {isCultural ? content.culturalParagraph : content.paragraph}
            </motion.p>

            {onSelectNav && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, "", "/visitas-virtuais");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                  className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[#8B0000] hover:bg-[#a30000] active:scale-95 text-white text-xs sm:text-sm 2xl:text-base font-bold tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer rounded-[3px]"
                >
                  <Compass className="w-4 h-4 text-white/90 group-hover:rotate-45 transition-transform duration-300" />
                  <span>Explorar Visitas 360°</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectNav("historias")}
                  className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 text-xs sm:text-sm 2xl:text-base font-semibold tracking-wide border border-neutral-300/80 transition-all cursor-pointer rounded-[3px]"
                >
                  <BookOpen className="w-4 h-4 text-neutral-600" />
                  <span>Tradição Oral</span>
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Foto Lateral com Moldura de 3px */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.94, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xs sm:max-w-sm md:max-w-[360px] lg:max-w-[360px] xl:max-w-[420px] 2xl:max-w-[460px] shrink-0"
          >
            <div className="overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.55)] border-2 border-black bg-neutral-900 aspect-[3/4] rounded-[3px]">
              <img
                src={natureImageSrc}
                alt="Mulher indígena cuidando e contemplando árvore nativa"
                className="w-full h-full object-cover object-center select-none"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
