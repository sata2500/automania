'use client';
import React from 'react';
import { Sparkles, Folder, Edit2, Trash2, GripVertical, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';

export const SeoGallerySection: React.FC = () => {
  const {
    foldersWithMockups,
    selectedFolderId,
    dbGeneratedMockups,
    handleFolderDragStart,
    handleFolderDragOver,
    handleFolderDrop,
    handleSelectFolder,
    editingFolderId,
    editingFolderName,
    setEditingFolderName,
    handleRenameFolder,
    setEditingFolderId,
    deletingFolderId,
    handleDeleteFolder,
    setDeletingFolderId,
    draggedFolderId,
    draggedMockupId,
    setDraggedMockupId,
    handleMockupDragStart,
    handleMockupDragOver,
    handleMockupDrop,
    handleMoveMockupStep,
    handleDeleteMockup,
  } = useEtsySeo();

  if (foldersWithMockups.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex items-center space-x-3">
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="text-xs text-amber-800 dark:text-amber-200">
          <span className="font-bold block">Henüz Toplu Üretim Yapmadınız</span>
          Mockup sekmesinde tasarımlarınızı hazırlayıp toplu üretime gönderdiğinizde, üretilen klasörler burada görüntülenecektir.
        </div>
      </div>
    );
  }

  const currentFolderMockups = selectedFolderId
    ? dbGeneratedMockups.filter((m: any) => m.folderId === selectedFolderId)
    : [];

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      {/* Folder Bar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Folder className="w-4 h-4 text-emerald-500" />
          Toplu Üretim Klasörleriniz ({foldersWithMockups.length} Adet):
        </label>
        {selectedFolderId && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/20 truncate max-w-full">
            Seçili Klasör: {foldersWithMockups.find((f: any) => f.id === selectedFolderId)?.name}
          </span>
        )}
      </div>

      {/* Folders Horizontal Scrollable List */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {foldersWithMockups.map((folder: any) => {
          const isSelected = selectedFolderId === folder.id;
          const thumbnailMockup = dbGeneratedMockups.find((m: any) => m.folderId === folder.id && !m.isVideo);
          return (
            <div
              key={folder.id}
              draggable
              onDragStart={(e) => handleFolderDragStart(e, folder.id)}
              onDragOver={handleFolderDragOver}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              onClick={() => handleSelectFolder(folder.id)}
              className={`group relative shrink-0 w-28 sm:w-32 rounded-xl border-2 p-2 cursor-pointer transition-all flex flex-col items-center gap-1.5 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
              } ${draggedFolderId === folder.id ? 'opacity-50 scale-95' : ''}`}
            >
              <div className="w-full h-18 sm:h-20 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                {thumbnailMockup?.previewUrl ? (
                  <img
                    src={thumbnailMockup.previewUrl}
                    alt={folder.name}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                ) : (
                  <Folder className="w-8 h-8 text-slate-400" />
                )}
                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                  {folder.count} dosya
                </span>
              </div>

              {/* Folder Rename / Name */}
              <div className="w-full text-center px-1">
                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={() => handleRenameFolder(folder.id, editingFolderName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                      if (e.key === 'Escape') setEditingFolderId(null);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-emerald-500 text-[10px] rounded px-1 py-0.5 outline-none font-bold text-center"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center justify-center gap-1 group/btn">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[75px] sm:max-w-[80px]" title={folder.name}>
                      {folder.name}
                    </span>
                    <Edit2
                      className="w-2.5 h-2.5 text-slate-400 opacity-80 sm:opacity-0 group-hover/btn:opacity-100 hover:text-emerald-500 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Delete folder button */}
              {deletingFolderId === folder.id ? (
                <div className="absolute inset-0 bg-slate-900/90 rounded-xl p-2 flex flex-col items-center justify-center gap-1 z-10 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[9px] text-white font-bold text-center">Klasörü sil?</span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded"
                      onClick={() => handleDeleteFolder(folder.id)}
                    >
                      Sil
                    </button>
                    <button
                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white text-[8px] rounded"
                      onClick={() => setDeletingFolderId(null)}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="absolute top-1 right-1 bg-red-500/80 text-white rounded p-0.5 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                  title="Klasörü Sil"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingFolderId(folder.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sürükle Bırak ve Oklarla Sıralama Alanı */}
      {selectedFolderId && currentFolderMockups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Etsy'ye Gönderilecek Görseller ({currentFolderMockups.length} Adet)</span>
            </label>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Sürükleyip veya oklarla sıralayabilirsiniz
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            {currentFolderMockups.map((mockup: any, idx: number, arr: any[]) => {
              const isDragged = draggedMockupId === mockup.id;
              return (
                <div
                  key={mockup.id}
                  draggable
                  onDragStart={(e) => handleMockupDragStart(e, mockup.id)}
                  onDragOver={handleMockupDragOver}
                  onDragEnter={(e) => e.preventDefault()}
                  onDragEnd={() => setDraggedMockupId(null)}
                  onDrop={(e) => handleMockupDrop(e, mockup.id)}
                  className={`group relative shrink-0 w-20 h-20 rounded-xl border-2 cursor-grab active:cursor-grabbing overflow-hidden bg-slate-50 dark:bg-slate-950 transition-all select-none ${
                    isDragged ? 'opacity-40 border-emerald-500 scale-95 ring-2 ring-emerald-400' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {mockup.isVideo ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 pointer-events-none select-none">
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">VİDEO</span>
                      <span className="text-[8px] text-slate-400">MP4</span>
                    </div>
                  ) : (
                    <img
                      src={mockup.previewUrl}
                      alt={mockup.mockupName}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />
                  )}

                  {/* Number Badge */}
                  <div className="absolute top-0 left-0 bg-black/70 text-white text-[9px] px-1.5 py-0.5 font-bold rounded-br-lg pointer-events-none select-none">
                    #{idx + 1}
                  </div>

                  {/* Hover & Touch Action Controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                    <div className="flex justify-between items-center">
                      <a
                        href={mockup.previewUrl}
                        download={mockup.exportFileName || mockup.mockupName || "mockup"}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-500 text-white rounded p-1 hover:bg-emerald-600 cursor-pointer shadow-xs"
                        title="İndir"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        className="bg-rose-500 text-white rounded p-1 hover:bg-rose-600 cursor-pointer shadow-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMockup(mockup.id);
                        }}
                        title="Kaldır"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Move Left / Right Step Buttons */}
                    <div className="flex justify-between items-center gap-1 bg-black/75 rounded p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveMockupStep(mockup.id, 'left');
                        }}
                        className="text-white hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-white p-0.5 transition-colors"
                        title="Sola Taşı"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[8px] font-bold text-slate-300 select-none">Sırala</span>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveMockupStep(mockup.id, 'right');
                        }}
                        className="text-white hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-white p-0.5 transition-colors"
                        title="Sağa Taşı"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
