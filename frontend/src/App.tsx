import React, { useEffect, useState } from "react";
import { ImageProvider } from "./context/ImageContext";
import { HeroSection } from "./components/sections/HeroSection";
import { Navbar } from "./components/layout/Navbar";
import { NatureSection } from "./components/sections/NatureSection";
import { CultureSection } from "./components/sections/CultureSection";
import { Footer } from "./components/layout/Footer";
import { ContentMode } from "./types";
import VirtualVisitsPage from "./VirtualVisitsPage";
import AdminPage from "./admin/AdminPage";
import { AboutSection } from "./components/sections/AboutSection";
import { StoriesSection } from "./components/sections/StoriesSection";
import { SchoolMemoriesPage } from "./components/sections/SchoolMemoriesPage";

function MainApp() {
  const [activeSection, setActiveSection] = useState("inicio");
  const [contentMode] = useState<ContentMode>("figma_exact");

  const handleNavSelect = (id: string) => {
    if (id === "eventos-escola") {
      window.history.pushState({}, "", "/memorias-da-escola#semanas-culturais");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.setTimeout(() => {
        document.getElementById("semanas-culturais")?.scrollIntoView();
      }, 0);
      return;
    }
    setActiveSection(id);
    if (id === "sobre" || id === "historias" || id === "escola" || id === "memorias-escola") {
      window.history.pushState({}, "", id === "sobre" ? "/sobre" : id === "historias" ? "/historias-contadas" : "/memorias-da-escola");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.scrollTo(0, 0);
      return;
    }
    if (id === "inicio") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (id === "visitas" || id === "visitas-info") {
      window.history.pushState({}, "", "/visitas-virtuais");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (
      id === "contato" ||
      id === "fale-conosco" ||
      id === "sobre" ||
      id === "manual"
    ) {
      const el =
        document.getElementById(id) ||
        document.getElementById("contato") ||
        document.querySelector("footer");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-900 flex flex-col font-sans selection:bg-[#8B0000] selection:text-white">
      <main className="flex-1">
        {/* 1. Hero com Slideshow Automático */}
        <HeroSection />

        {/* 2. Barra de Navegação Vermelha Sticky */}
        <Navbar activeSection={activeSection} onSelectNav={handleNavSelect} />

        {/* 3. Seção Floresta com Parallax de Portal */}
        <NatureSection mode={contentMode} onSelectNav={handleNavSelect} />

        {/* 4. Seção Cultura e Memórias */}
        <CultureSection mode={contentMode} onSelectNav={handleNavSelect} />
      </main>

      {/* 5. Rodapé Preto Puro de 3 Colunas com Ancoragem */}
      <Footer onSelectNav={handleNavSelect} />
    </div>
  );
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  if (pathname === "/painel" || pathname === "/painel/") return <AdminPage />;

  const isStoriesPage = pathname === "/historias-contadas" || pathname === "/historias-contadas/";
  const isSchoolPage = pathname === "/memorias-da-escola" || pathname === "/memorias-da-escola/";

  if (pathname === "/sobre" || pathname === "/sobre/" || isStoriesPage || isSchoolPage) {
    const navigateFromAbout = (id: string) => {
      if (id === "sobre" || id === "historias" || id === "escola" || id === "memorias-escola") {
        window.history.pushState({}, "", id === "sobre" ? "/sobre" : id === "historias" ? "/historias-contadas" : "/memorias-da-escola");
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.scrollTo(0, 0);
        return;
      }
      const tour = id === "visitas" || id === "visitas-info";
      window.history.pushState({}, "", tour ? "/visitas-virtuais" : `/#${id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.setTimeout(() => {
        const target = document.getElementById(id === "escola" ? "memorias-escola" : id);
        if (target) target.scrollIntoView();
        else window.scrollTo(0, 0);
      }, 0);
    };
    return (
      <div className="min-h-screen bg-neutral-950 font-sans flex flex-col">
        <Navbar activeSection={isSchoolPage ? "escola" : isStoriesPage ? "historias" : "sobre"} onSelectNav={navigateFromAbout} />
        <main className="flex-1">{isSchoolPage ? <SchoolMemoriesPage /> : isStoriesPage ? <StoriesSection /> : <AboutSection />}</main>
        {!isStoriesPage && <Footer onSelectNav={navigateFromAbout} />}
      </div>
    );
  }

  if (pathname === "/visitas-virtuais") {
    return <VirtualVisitsPage />;
  }

  return (
    <ImageProvider>
      <MainApp />
    </ImageProvider>
  );
}
