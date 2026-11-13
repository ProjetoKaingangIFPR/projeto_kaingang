import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden border border-neutral-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col rounded-[3px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-neutral-100 bg-[#8B0000] text-white">
          <div>
            <h3 id="modal-title" className="text-xl font-bold tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-red-100 mt-1 font-medium">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer rounded-[3px]"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-neutral-700 text-sm leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 p-4 border-t border-neutral-100 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold text-white bg-[#8B0000] hover:bg-[#a50000] active:scale-95 transition-all shadow-md hover:shadow-lg cursor-pointer rounded-[3px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
