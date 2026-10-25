'use client';

/**
 * Mockup klasörünün otomasyon şablonu: Toplu Üretim › Otomasyon Şablonları ile aynı kayıt ve aynı sihirbaz.
 * Klasöre bağlı şablon varsa düzenlenir; yoksa klasörün mockup'larıyla ön doldurulmuş yeni şablon açılır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { MockupFolder, MockupItem } from '@/types/pod';
import type { PodTemplate, PodTemplateInput } from '@/types/templates';
import { buildFolderMockupConfig, findFolderTemplate } from '@/lib/folder-template';
import { fetchTemplates, saveTemplate } from '@/lib/templates-client';
import { useToast } from '@/components/common/ToastContext';
import { LoadingState } from '@/components/common/Spinner';
import { TemplateBuilderModal } from './TemplateBuilderModal';

interface FolderTemplateDialogProps {
  folder: MockupFolder;
  mockups: MockupItem[];
  onClose: () => void;
}

type LoadState = { status: 'loading' } | { status: 'ready'; template: PodTemplate | null };

export function FolderTemplateDialog({ folder, mockups, onClose }: FolderTemplateDialogProps) {
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchTemplates()
      .then((templates) => {
        if (!cancelled) setState({ status: 'ready', template: findFolderTemplate(templates, folder.id) });
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Şablonlar yüklenemedi.');
        onClose();
      });
    return () => { cancelled = true; };
  }, [folder.id, toast, onClose]);

  // Yeni şablon: klasörün adı ve mockup'larıyla başlar.
  const initial = useMemo<Partial<PodTemplateInput>>(() => ({
    name: folder.name,
    mockupConfig: buildFolderMockupConfig(folder.id, mockups),
  }), [folder.id, folder.name, mockups]);

  if (state.status === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl px-6 py-5 shadow-xl">
          <LoadingState label="Klasörün şablonu yükleniyor" />
        </div>
      </div>
    );
  }

  const template = state.template;
  const handleSave = async (data: PodTemplateInput, id?: string) => {
    try {
      // Klasör bağlantısı her kayıtta korunur (eski kayıtlarda da eklenir).
      await saveTemplate({ ...data, mockupConfig: { ...data.mockupConfig, folderId: folder.id } }, id);
      toast.success(id ? 'Klasörün otomasyon şablonu güncellendi.' : 'Klasör için otomasyon şablonu oluşturuldu.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Şablon kaydedilemedi.');
    }
  };

  return (
    <TemplateBuilderModal
      mockups={mockups}
      template={template}
      initial={template ? undefined : initial}
      folderName={folder.name}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
