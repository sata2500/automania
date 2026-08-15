'use client';
import React from 'react';
import { useEtsySeo } from '../context/EtsySeoContext';
import { VariationControlsBar } from '../variations/VariationControlsBar';
import { VariationTableView } from '../variations/VariationTableView';
import { VariationModals } from '../variations/VariationModals';

export const VariationMatrix: React.FC = () => {
  const { activeTab } = useEtsySeo();

  if (activeTab !== 'variations') return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Variation Controls & Combination Generator Bar */}
      <VariationControlsBar />

      {/* 2. Interactive Matrix Table */}
      <VariationTableView />

      {/* 3. Modals: Save, Load, Fetch Listings, Bulk Sync */}
      <VariationModals />
    </div>
  );
};