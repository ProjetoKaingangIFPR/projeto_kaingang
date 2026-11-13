import { api } from '../../admin/api';
import React, { useState } from 'react';
import { Point360, ArtworkHotspot } from '../types';
import { PRESET_PANOS } from '../utils/proceduralPano';
import { Temporary360HotspotCalibrator } from './Temporary360HotspotCalibrator';
import { 
  Upload, 
  Compass, 
  Link2, 
  Trash2, 
  Check, 
  Sparkles, 
  ChevronDown, 
  Pencil, 
  ChevronRight,
  Eye,
  MapPin,
  X
} from 'lucide-react';

interface PointConfigModalProps {
  point: Point360;
  allPoints: Point360[];
  onSave: (updatedPoint: Point360) => void;
  onClose: () => void;
  onOpenCalibratorDirectly?: boolean;
}

export const PointConfigModal: React.FC<PointConfigModalProps> = ({
  point,
  allPoints,
  onSave,
  onClose,
  onOpenCalibratorDirectly = false
}) => {
  const [name, setName] = useState(point.name || '');
  const [description, setDescription] = useState(point.description || '');
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(Boolean(point.description));
  const [panoramaUrl, setPanoramaUrl] = useState(point.panoramaUrl);
  const [initialYaw, setInitialYaw] = useState(point.initialYaw || 0);
  const [color, setColor] = useState(point.color || '#111111');
  const [connectedPointIds, setConnectedPointIds] = useState<string[]>(
    point.connectedPointIds || []
  );
  const [hotspots, setHotspots] = useState<ArtworkHotspot[]>(point.hotspots || []);
  const isCustomUploaded = Boolean(
    point.panoramaUrl && (
      point.panoramaUrl.startsWith('/api/media/') ||
      point.panoramaUrl.startsWith('http://') ||
      point.panoramaUrl.startsWith('https://') ||
      point.panoramaUrl.startsWith('blob:')
    )
  );

  const [activeTab, setActiveTab] = useState<'preset' | 'upload'>(
    isCustomUploaded ? 'upload' : 'preset'
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Temporary 360 Hotspot Calibrator modal state
  const [isCalibratorOpen, setIsCalibratorOpen] = useState(onOpenCalibratorDirectly);
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const processSelectedFile = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const result = await api<{url: string}>('/api/admin/media', {method: 'POST', headers: {'Content-Type': file.type}, body: file});
      setPanoramaUrl(result.url);
      setActiveTab('upload');
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Falha no envio.'); }
    finally { setUploading(false); }
  };

  // Local file upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleToggleConnection = (targetId: string) => {
    if (connectedPointIds.includes(targetId)) {
      setConnectedPointIds(connectedPointIds.filter((id) => id !== targetId));
    } else {
      setConnectedPointIds([...connectedPointIds, targetId]);
    }
  };

  const handleRemoveHotspot = (id: string) => {
    setHotspots(hotspots.filter((h) => h.id !== id));
    if (editingSpotId === id) {
      setEditingSpotId(null);
    }
  };

  const handleSave = () => {
    onSave({
      ...point,
      name: name.trim(),
      description: description.trim(),
      panoramaUrl,
      initialYaw,
      color,
      connectedPointIds,
      hotspots
    });
  };

  const otherPoints = allPoints.filter((p) => p.id !== point.id);

  return (
    <>
      <div 
        id="point-config-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
      >
        <div 
          id="point-config-modal"
          className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 text-neutral-900 shadow-2xl border border-neutral-200 space-y-6 my-6 max-h-[92vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs">
                W.
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono-data">
                  Configuração de Ambiente
                </span>
                <h2 className="text-lg font-bold text-black font-display">
                  {name || 'Ambiente sem Nome'}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-black p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section 1: Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-700 mb-1.5">
                Nome da Sala / Galeria
              </label>
              <input
                id="input-point-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Grande Átrio, Salão Nobre, Sala de Pinturas..."
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:border-black transition-colors placeholder:text-neutral-400"
              />
            </div>

            {/* Cultural Description */}
            <div className="pt-0.5">
              <button
                type="button"
                id="btn-toggle-point-description"
                onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-black hover:text-neutral-600 transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isDescriptionOpen ? 'rotate-180' : ''
                  }`}
                />
                <span>{isDescriptionOpen ? 'Ocultar Descrição Cultural' : '+ Adicionar Descrição Cultural & Histórica'}</span>
              </button>

              {isDescriptionOpen && (
                <div className="mt-2.5">
                  <textarea
                    id="input-point-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Escreva anotações históricas, arquitetônicas ou dados do acervo deste ambiente..."
                    rows={2}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-black resize-none transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: 360 Panorama Selector */}
          <div className="space-y-3 border-t border-neutral-100 pt-5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase text-neutral-700">
                Imagem Panorâmica 360°
              </label>
              <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('preset')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeTab === 'preset'
                      ? 'bg-white text-black font-bold shadow-xs'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  Modelos de Galeria
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeTab === 'upload'
                      ? 'bg-white text-black font-bold shadow-xs'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  Upload de Foto
                </button>
              </div>
            </div>

            {activeTab === 'preset' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                {PRESET_PANOS.map((preset) => {
                  const isSelected = panoramaUrl === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setPanoramaUrl(preset.id)}
                      className={`group cursor-pointer rounded-xl border p-2.5 transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-black bg-neutral-50 shadow-xs'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="w-16 h-11 rounded-lg overflow-hidden shrink-0 border border-neutral-200 bg-neutral-100">
                        <img
                          src={preset.thumbnail}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {preset.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {preset.category}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-white shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {panoramaUrl && (panoramaUrl.startsWith('/api/media/') || panoramaUrl.startsWith('http://') || panoramaUrl.startsWith('https://') || panoramaUrl.startsWith('blob:')) ? (
                  <div className="border border-neutral-200 rounded-xl p-3.5 bg-neutral-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-neutral-900">
                          Foto 360° Personalizada Carregada
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPanoramaUrl('grand_atrium')}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        Remover Foto
                      </button>
                    </div>

                    <div className="relative aspect-[2/1] w-full rounded-lg overflow-hidden border border-neutral-300 bg-neutral-900 shadow-inner group">
                      <img
                        src={panoramaUrl}
                        alt="Preview 360°"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label
                          htmlFor="file-upload-360-replace"
                          className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-lg cursor-pointer shadow-md hover:bg-neutral-100 transition-all flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Substituir Foto</span>
                        </label>
                      </div>
                    </div>

                    <input
                      type="file"
                      id="file-upload-360-replace"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-7 text-center transition-all ${
                      isDraggingFile
                        ? 'border-black bg-neutral-100 scale-[1.01]'
                        : 'border-neutral-300 bg-neutral-50 hover:border-black hover:bg-neutral-100/60'
                    }`}
                  >
                    <input
                      type="file"
                      id="file-upload-360"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload-360"
                      className="cursor-pointer flex flex-col items-center justify-center gap-2.5"
                    >
                      <div className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center shadow-xs">
                        <Upload className="w-5 h-5 text-neutral-800" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black block">
                          Clique ou arraste sua foto panorâmica 360° aqui
                        </span>
                        <span className="text-[11px] text-neutral-500 mt-0.5 block">
                          Formatos suportados: JPG, PNG, WEBP (proporção 2:1 recomendada)
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: 360 Hotspot Visual Calibrator CTA */}
          <div className="border-t border-neutral-100 pt-5">
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-black text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-black">
                    Fixar Obras & Informações no Espaço 360°
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {hotspots.length} {hotspots.length === 1 ? 'obra fixada' : 'obras fixadas'} nesta sala
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-open-360-calibrator"
                onClick={() => setIsCalibratorOpen(true)}
                className="w-full sm:w-auto px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider"
              >
                <span>Abrir Calibrador 360°</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section 4: Connections to other rooms */}
          {otherPoints.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-5">
              <label className="block text-xs font-bold uppercase text-neutral-700">
                Portas e Conexões com Outras Salas
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {otherPoints.map((other) => {
                  const isConnected = connectedPointIds.includes(other.id);
                  return (
                    <button
                      key={other.id}
                      type="button"
                      onClick={() => handleToggleConnection(other.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                        isConnected
                          ? 'bg-neutral-100 border-black text-black'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <span className="truncate">{other.name}</span>
                      <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800">
                        {isConnected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {uploadError && <p role="alert" className="text-sm text-red-600">{uploadError}</p>}
          {uploading && <p role="status" className="text-sm">Enviando imagem…</p>}
          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={uploading}
              id="btn-save-point-config"
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-lg shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Ambiente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Temporary 360 Visual Calibrator Modal */}
      {isCalibratorOpen && (
        <Temporary360HotspotCalibrator
          point={{ ...point, panoramaUrl, initialYaw }}
          initialHotspots={hotspots}
          onSaveHotspots={(updatedHotspots) => {
            setHotspots(updatedHotspots);
          }}
          onClose={() => setIsCalibratorOpen(false)}
        />
      )}
    </>
  );
};
