import React, { createContext, useContext, useState, useEffect } from "react";

export interface ImageSlot {
  key: string;
  label: string;
  description: string;
  defaultPath: string;
  originalFileNameMatch: string[];
}

export const IMAGE_SLOTS: ImageSlot[] = [
  {
    key: "hero",
    label: "Hero Principal (Crianças em Círculo na Grama)",
    description: "WhatsApp Image 2026-09-23 at 20.46.32.jpeg",
    defaultPath: "/images/hero.jpg",
    originalFileNameMatch: ["20.46.32", "crianca", "hero", "peneira"],
  },
  {
    key: "nature",
    label: "Foto Seção 1 (Mulher e Árvore Nativa)",
    description: "WhatsApp Image 2026-09-23 at 20.46.33.jpeg",
    defaultPath: "/images/mulher-planta.jpeg",
    originalFileNameMatch: [
      "20.46.33.jpeg",
      "20.46.33.jpg",
      "arvore",
      "saberes",
      "elder",
    ],
  },
  {
    key: "culture",
    label: "Foto Seção 2 (Jovens e Cântico/Dança Tradicional)",
    description: "WhatsApp Image 2026-09-23 at 20.46.33(1).jpeg",
    defaultPath: "/images/amostra.jpeg",
    originalFileNameMatch: [
      "20.46.33(1)",
      "cultura",
      "danca",
      "ceremonia",
      "tradicao",
    ],
  },
  {
    key: "forestBg",
    label: "Fundo da Seção 1 (Floresta Tropical)",
    description: "Fundo panorâmico de mata atlântica / floresta exuberante",
    defaultPath: "/images/floresta-bg.png",
    originalFileNameMatch: ["floresta", "forest", "mata", "canopy"],
  },
];

interface ImageContextType {
  images: Record<string, string>;
  setImage: (key: string, dataUrl: string) => void;
  resetToDefault: () => void;
  handleBatchUpload: (
    files: FileList | File[],
  ) => Promise<{ matched: number; total: number }>;
}

const STORAGE_KEY = "memorias_vivas_custom_images";

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export const ImageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [images, setImages] = useState<Record<string, string>>(() => {
    const defaultMap: Record<string, string> = {};
    IMAGE_SLOTS.forEach((slot) => {
      defaultMap[slot.key] = slot.defaultPath;
    });

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultMap, ...parsed };
      }
    } catch {
      // ignore storage error
    }
    return defaultMap;
  });

  const setImage = (key: string, dataUrl: string) => {
    setImages((prev) => {
      const updated = { ...prev, [key]: dataUrl };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Storage full or unavailable", e);
      }
      return updated;
    });
  };

  const resetToDefault = () => {
    const defaultMap: Record<string, string> = {};
    IMAGE_SLOTS.forEach((slot) => {
      defaultMap[slot.key] = slot.defaultPath;
    });
    setImages(defaultMap);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleBatchUpload = async (
    files: FileList | File[],
  ): Promise<{ matched: number; total: number }> => {
    let matched = 0;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const name = file.name.toLowerCase();
      let targetKey: string | null = null;

      // Special case for (1) vs non-(1)
      if (
        name.includes("20.46.33(1)") ||
        name.includes("cultura") ||
        name.includes("danca")
      ) {
        targetKey = "culture";
      } else if (
        name.includes("20.46.33") ||
        name.includes("arvore") ||
        name.includes("saberes")
      ) {
        targetKey = "nature";
      } else if (
        name.includes("20.46.32") ||
        name.includes("hero") ||
        name.includes("crianca")
      ) {
        targetKey = "hero";
      } else if (
        name.includes("floresta") ||
        name.includes("forest") ||
        name.includes("bg")
      ) {
        targetKey = "forestBg";
      }

      if (targetKey) {
        matched++;
        const base64 = await readFileAsDataUrl(file);
        setImage(targetKey, base64);
      }
    }

    return { matched, total: fileArray.length };
  };

  return (
    <ImageContext.Provider
      value={{ images, setImage, resetToDefault, handleBatchUpload }}
    >
      {children}
    </ImageContext.Provider>
  );
};

export const useImages = () => {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error("useImages must be used within an ImageProvider");
  }
  return context;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
