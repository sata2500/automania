import React, { useEffect, useRef } from 'react';
import { Folder, X } from 'lucide-react';
import { DialogPanel } from '@/components/common/DialogPanel';
import { CategoryPicker, type TaxonomyOption } from '@/components/templates/sections/CategoryPicker';

interface MockupFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  folderName: string;
  setFolderName: (name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Ürün kategorisi seçenekleri (admin panelinde aktif Etsy kategorileri); null: gösterilmez (misafir) */
  categories?: TaxonomyOption[] | null;
  taxonomyId?: number;
  setTaxonomyId?: (id: number) => void;
}

export const MockupFolderModal: React.FC<MockupFolderModalProps> = ({
  isOpen,
  onClose,
  isEditing,
  folderName,
  setFolderName,
  onSubmit,
  categories = null,
  taxonomyId = 0,
  setTaxonomyId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <DialogPanel aria-labelledby="mockup-folder-modal-title" onClose={onClose}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 id="mockup-folder-modal-title" className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-500" />
            {isEditing ? 'Klasör: ad ve kategori' : 'Yeni Klasör Oluştur'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Modalı kapat"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Klasör Adı
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Örn: Sweatshirt, Kadın Tişört..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {categories && setTaxonomyId && (
            <div>
              <label htmlFor="folder-category" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Ürün kategorisi
              </label>
              {categories.length > 0 ? (
                <CategoryPicker id="folder-category" categories={categories} value={taxonomyId} onChange={setTaxonomyId} />
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Admin panelinde (Etsy Kategorileri) kategori etkinleştirilince burada seçilir.</p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Klasör bir Etsy ilanıdır: bu klasörden üretilen ilanlar (elle veya otomasyonla) bu kategoriyle açılır. Her klasörde tek ürün türü önerilir.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow transition-opacity"
            >
              {isEditing ? 'Kaydet' : 'Oluştur'}
            </button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
};
