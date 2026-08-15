'use client';
import React from 'react';
import { TagMatrixScore } from '../components/TagMatrixScore';
import { useEtsySeo } from '../context/EtsySeoContext';

export const SeoTagHealthSection: React.FC = () => {
  const { selectedTags, generatedTitle } = useEtsySeo();

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">4</span>
            13 Etiket Sağlık & Çeşitlilik Matrisi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Seçilen 13 etiketin karakter limitleri, benzersizlik, arama hacmi ve mevsimsellik denetimi.
          </p>
        </div>
      </div>

      {/* Real-time Tag Health Matrix & Intent Distribution Score */}
      <TagMatrixScore
        tags={selectedTags}
        title={generatedTitle}
      />
    </div>
  );
};
