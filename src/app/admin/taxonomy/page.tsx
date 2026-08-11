'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, CheckCircle2, XCircle } from 'lucide-react';

export default function TaxonomyAdminPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/taxonomy-sync');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('Etsy\'den 10.000+ kategori ağacı çekilecek. Bu işlem birkaç saniye sürebilir. Onaylıyor musunuz?')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/taxonomy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Başarılı! Toplam ${data.count} kategori senkronize edildi.`);
        fetchCategories();
      } else {
        alert(`Hata: ${data.error}`);
      }
    } catch (e: any) {
      alert('Bağlantı hatası: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: nextStatus } : c));
    
    try {
      await fetch('/api/admin/taxonomy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, isActive: nextStatus })
      });
    } catch (e) {
      console.error('Update failed', e);
      // Revert on error
      setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: currentStatus } : c));
    }
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (filterActive !== null && c.isActive !== filterActive) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return c.name.toLowerCase().includes(lower) || 
               c.id.toString().includes(lower) || 
               (c.path && c.path.toLowerCase().includes(lower));
      }
      return true;
    });
  }, [categories, searchTerm, filterActive]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Etsy Kategori Yönetimi</h1>
          <p className="text-gray-500 text-sm">Yapay zekanın SEO üretirken kullanabileceği (Print-on-Demand) kategorilerini belirleyin.</p>
        </div>
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Senkronize Ediliyor...' : 'Etsy\'den Güncelle'}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Kategori adı, ID veya yol ara..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterActive(null)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${filterActive === null ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'}`}
          >
            Tümü ({categories.length})
          </button>
          <button 
            onClick={() => setFilterActive(true)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${filterActive === true ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'}`}
          >
            Sadece Aktif Olanlar ({categories.filter(c => c.isActive).length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori Adı / Yolu</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Durum</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">İşlem</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Yükleniyor...</td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Kategori bulunamadı. Lütfen "Etsy'den Güncelle" butonuna basın.</td></tr>
              ) : (
                filteredCategories.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${c.isActive ? 'bg-green-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{c.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{c.path}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {c.isActive ? 
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3"/> Aktif</span> : 
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><XCircle className="w-3 h-3"/> Pasif</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button 
                        onClick={() => handleToggle(c.id, c.isActive)}
                        className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${c.isActive ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' : 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'}`}
                      >
                        {c.isActive ? 'Kapat' : 'Aktifleştir'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
