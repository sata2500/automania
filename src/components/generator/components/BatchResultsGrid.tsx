'use client';

import React from 'react';
import { RenderedMatch } from '@/types/pod';
import { CheckCircle2 } from 'lucide-react';
import { BatchResultCard } from './BatchResultCard';

interface BatchResultsGridProps {
  renderedMatches: RenderedMatch[];
}

export const BatchResultsGrid: React.FC<BatchResultsGridProps> = ({ renderedMatches }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Toplu Üretim Tamamlandı ({renderedMatches.length} Varyasyon)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {renderedMatches.map((match) => (
          <BatchResultCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
};
