import React from "react";
import { motion } from "framer-motion";
import { useImages } from "../../context/ImageContext";
import { FRAME_TEXTS } from "../../data/content";
import { ContentMode } from "../../types";
import { ShieldAlert, Mail, ArrowRight } from "lucide-react";

interface CultureSectionProps {
  mode: ContentMode;
  onSelectNav?: (id: string) => void;
}

export const CultureSection: React.FC<CultureSectionProps> = ({
  mode,
  onSelectNav,
}) => {
  const { images } = useImages();
  const content = FRAME_TEXTS.section2;
  const isCultural = mode === "cultural_full";

  const cultureImageSrc = images.culture || "/images/amostra.jpeg";

  return (
    <section
      id="memorias-escola"
      className="relative w-full overflow-hidden py-14 sm:py-20 md:py-28 lg:py-32 xl:py-36 2xl:py-40 bg-[#8B0000] scroll-mt-14 md:scroll-mt-16"
      aria-label="Seção Memórias e Cultura"
    >
      {/* Layout Principal com Revelação Suave ao Scroll (Framer Motion Reveal) */}
      <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 2xl:px-20">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-12 xl:gap-16">
          {/* Left: Card Branco com Revelação Lateral Suave */}
          <motion.div
            initial={{ opacity: 0, x: -50, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
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

            {/* Ações / Botões Estilizados e Redesenhados */}
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
                  onClick={() => onSelectNav("manual")}
                  className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[#8B0000] hover:bg-[#a30000] active:scale-95 text-white text-xs sm:text-sm 2xl:text-base font-bold tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer rounded-[3px]"
                >
                  <ShieldAlert className="w-4 h-4 text-white/90" />
                  <span>Manual de Conduta</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectNav("fale-conosco")}
                  className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 text-xs sm:text-sm 2xl:text-base font-semibold tracking-wide border border-neutral-300/80 transition-all cursor-pointer rounded-[3px]"
                >
                  <Mail className="w-4 h-4 text-neutral-600" />
                  <span>Fale Conosco</span>
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Right: Foto com Bordas Arredondadas de 3px */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.94, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xs sm:max-w-sm md:max-w-[360px] lg:max-w-[360px] xl:max-w-[420px] 2xl:max-w-[460px] shrink-0"
          >
            <div className="overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.55)] border-2 border-black bg-neutral-900 aspect-[3/4] rounded-[3px]">
              <img
                src={cultureImageSrc}
                alt="Celebração cultural tradicional indígena"
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
