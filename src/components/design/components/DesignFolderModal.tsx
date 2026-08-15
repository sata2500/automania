import React from 'react';
import { Folder, X, Check } from 'lucide-react';
import { MockupFolder } from '@/types/pod';

interface DesignFolderModalProps {
  isOpen: boolean;
  editingFolder: MockupFolder | null;
  folderInputName: string;
  setFolderInputName: (name: string) => void;
  onClose: () => void;
  onSave: (e?: React.FormEvent) => void;
}

export const DesignFolderModal: React.FC<DesignFolderModalProps> = ({
  isOpen,
  editingFolder,
  folderInputName,
  setFolderInputName,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingFolder ? 'Klasör Adını Düzenle' : 'Yeni Tasarım Klasörü'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editingFolder
                  ? 'Klasörünüzün yeni ismini belirleyin.'
                  : 'Tasarımlarınızı kategorize etmek için bir isim girin.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Klasör Adı
            </label>
            <input
              type="text"
              value={folderInputName}
              onChange={(e) => setFolderInputName(e.target.value)}
              placeholder="Örn: Vektör Çizimler, Koyu Seri, 2026 Sezonu"
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingFolder ? 'Kaydet' : 'Oluştur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
