'use client';

import React from 'react';
import { RenderedMatch } from '@/types/pod';
import { Video, Download } from 'lucide-react';

interface BatchResultCardProps {
  match: RenderedMatch;
}

export const BatchResultCard: React.FC<BatchResultCardProps> = ({ match }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm group">
      <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 relative flex items-center justify-center mb-3 group/img">
        {match.isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">
            <Video className="w-8 h-8 mb-1 opacity-80" />
            <span className="text-[10px] font-bold">Video Mockup</span>
          </div>
        ) : (
          <>
            <img src={match.previewUrl} alt={match.exportFileName} className="w-full h-full object-contain" />
            <a
              href={match.previewUrl}
              download={match.exportFileName}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-sm shadow-lg cursor-pointer"
              title="İndir"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-4 h-4" />
            </a>
          </>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={match.exportFileName}>
          {match.exportFileName}
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          <span className="truncate max-w-[140px]">{match.folderName}</span>
          <span className="text-indigo-500 dark:text-indigo-400 font-mono">#{match.folderOrderIndex}</span>
        </div>
      </div>
    </div>
  );
};
