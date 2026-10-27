'use client';

/**
 * Mockup klasörünün otomasyonu: Üretim › Otomasyonlar ile aynı kayıt ve aynı sihirbaz.
 * Klasöre bağlı otomasyon varsa düzenlenir; yoksa yeni kurulum başlar.
 */
import React, { useEffect, useState } from 'react';
import type { MockupFolder, MockupItem } from '@/types/pod';
import type { PodTemplate } from '@/types/templates';
import { findFolderTemplate } from '@/lib/folder-template';
import { fetchTemplates } from '@/lib/templates-client';
import { useToast } from '@/components/common/ToastContext';
import { LoadingState } from '@/components/common/Spinner';
import { AutomationWizard } from './AutomationWizard';

interface FolderTemplateDialogProps {
  folder: MockupFolder;
  folders: MockupFolder[];
  mockups: MockupItem[];
  onClose: () => void;
}

type LoadState = { status: 'loading' } | { status: 'ready'; template: PodTemplate | null };

export function FolderTemplateDialog({ folder, folders, mockups, onClose }: FolderTemplateDialogProps) {
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
        toast.error(err instanceof Error ? err.message : 'Otomasyonlar yüklenemedi.');
        onClose();
      });
    return () => { cancelled = true; };
  }, [folder.id, toast, onClose]);

  if (state.status === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl px-6 py-5 shadow-xl">
          <LoadingState label="Klasörün otomasyonu yükleniyor" />
        </div>
      </div>
    );
  }

  return (
    <AutomationWizard
      folders={folders}
      mockups={mockups}
      template={state.template}
      folderId={folder.id}
      onSaved={onClose}
      onClose={onClose}
    />
  );
}
