import React, { useState, useRef } from 'react';
import { X, UploadCloud, RefreshCw, CheckCircle2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useImages, IMAGE_SLOTS } from '../../context/ImageContext';

interface ImageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImageManagerModal: React.FC<ImageManagerModalProps> = ({ isOpen, onClose }) => {
  const { images, setImage, resetToDefault, handleBatchUpload } = useImages();
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const { matched, total } = await handleBatchUpload(e.dataTransfer.files);
      setUploadMsg(`${matched} de ${total} arquivo(s) associado(s) com sucesso aos slots do Figma!`);
      setTimeout(() => setUploadMsg(null), 4000);
    }
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const { matched, total } = await handleBatchUpload(e.target.files);
      setUploadMsg(`${matched} de ${total} imagem(ns) carregada(s) com sucesso!`);
      setTimeout(() => setUploadMsg(null), 4000);
    }
  };

  const handleSingleSlotUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImage(key, reader.result as string);
        setUploadMsg(`Imagem atualizada com sucesso!`);
        setTimeout(() => setUploadMsg(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-neutral-900 text-white shadow-2xl border border-neutral-700 overflow-hidden flex flex-col max-h-[90vh] rounded-[3px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#8B0000]">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base sm:text-lg">
              Carregar Imagens Originais do WhatsApp / Figma
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 transition-colors rounded-[3px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Info note explaining how AI Studio uploads work */}
          <div className="p-3.5 bg-neutral-800/80 border border-neutral-700 text-xs leading-relaxed text-neutral-300 rounded-[3px]">
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Por que suas fotos originais não carregaram sozinhas?</span>
            </div>
            No ambiente do AI Studio, as imagens anexadas no chat são enviadas para a visão da IA analisar o design, mas a plataforma não as grava automaticamente no disco do projeto. Arraste suas imagens abaixo para aplicá-las em alta resolução na mesma hora!
          </div>

          {/* Drag & Drop Multi-file Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-6 text-center cursor-pointer transition-all rounded-[3px] ${
              dragOver
                ? 'border-emerald-400 bg-emerald-950/30'
                : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={onFileInputChange}
            />
            <UploadCloud className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
            <p className="font-semibold text-neutral-200">
              Arraste e solte aqui seus 3 arquivos de imagem (ou clique para selecionar)
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Aceita <code className="text-emerald-400">WhatsApp Image 2026-09-23 at 20.46...</code> e qualquer .jpg/.png
            </p>
          </div>

          {uploadMsg && (
            <div className="p-3 bg-emerald-950 border border-emerald-500/50 text-emerald-200 flex items-center gap-2 text-xs font-medium rounded-[3px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadMsg}</span>
            </div>
          )}

          {/* Individual Slot Cards */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
              Slots de Imagens da Página:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {IMAGE_SLOTS.map((slot) => {
                const currentSrc = images[slot.key];
                return (
                  <div
                    key={slot.key}
                    className="flex items-center gap-3 p-3 bg-neutral-800/60 border border-neutral-700 rounded-[3px]"
                  >
                    <img
                      src={currentSrc}
                      alt={slot.label}
                      className="w-14 h-14 object-cover border border-neutral-600 shrink-0 bg-neutral-900 rounded-[3px]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-white truncate">
                        {slot.label}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {slot.description}
                      </p>
                      <label className="inline-block mt-1 text-[11px] text-[#FF4D4D] hover:underline cursor-pointer font-medium">
                        Substituir esta foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSingleSlotUpload(slot.key, e)}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={resetToDefault}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restaurar imagens padrão</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#8B0000] hover:bg-[#a00000] text-white font-semibold transition-colors rounded-[3px]"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
