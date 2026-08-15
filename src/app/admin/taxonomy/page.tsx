'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import TaxonomyManagement from '@/components/admin/TaxonomyManagement';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function TaxonomyAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Quick Link to Main Admin Panel */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Admin Paneline Dön</span>
          </Link>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Yönetici Yetkisi Doğrulandı</span>
          </div>
        </div>

        {/* Embedded Modern Taxonomy Management Component */}
        <ErrorBoundary fallbackTitle="Kategori ve Taksonomi Yüklenirken Bir Hata Oluştu">
          <TaxonomyManagement />
        </ErrorBoundary>
      </div>
    </div>
  );
}
