'use client';
import React from 'react';
import { useEtsySeo } from '../context/EtsySeoContext';
import { SeoGallerySection } from '../studio/SeoGallerySection';
import { SeoDesignConfigSection } from '../studio/SeoDesignConfigSection';
import { SeoAiCopySection } from '../studio/SeoAiCopySection';
import { SeoStoreParamsAccordion } from '../studio/SeoStoreParamsAccordion';
import { SeoTagHealthSection } from '../studio/SeoTagHealthSection';
import { SeoPublishSection } from '../studio/SeoPublishSection';

export const AIListingStudio: React.FC = () => {
  const { activeTab } = useEtsySeo();

  if (activeTab !== 'studio' && activeTab !== 'publish') return null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 0. BATCH MOCKUP GALLERY & REORDERING */}
      <SeoGallerySection />

      {/* 1. ADIM: TASARIM & ÜRÜN YAPILANDIRMASI */}
      <SeoDesignConfigSection />

      {/* 2. ADIM: YAPAY ZEKA SEO METİNLERİ & 13 ALTIN ETİKET */}
      <SeoAiCopySection />

      {/* 3. ADIM: ETSY MAĞAZA & KATEGORİ PARAMETRELERİ (AÇILIR-KAPANIR ACCORDION) */}
      <SeoStoreParamsAccordion />

      {/* 4. ADIM: ETİKET SAĞLIK MATRİSİ & ÇEŞİTLİLİK DENETİMİ */}
      <SeoTagHealthSection />

      {/* 5. ADIM: CANLI SERP ÖNİZLEME & ETSY'YE AKTARMA İSTASYONU */}
      <SeoPublishSection />
    </div>
  );
};