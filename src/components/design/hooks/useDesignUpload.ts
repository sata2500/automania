import { useState, useCallback } from 'react';
import { DesignItem } from '@/types/pod';
import { optimizeDesignImage } from '@/lib/image-optimizer';
import { useToast } from '@/components/common/ToastContext';

interface UseDesignUploadProps {
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
  activeDesignFolderId: string | null;
}

export function useDesignUpload({ setDesigns, activeDesignFolderId }: UseDesignUploadProps) {
  const toast = useToast();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsOptimizing(true);
      const fileArray = Array.from(files).filter(
        (f) => f.type.startsWith('image/') || f.name.endsWith('.svg')
      );
      if (fileArray.length === 0) {
        setIsOptimizing(false);
        return;
      }

      const uploadToastId = toast.progress('Tasarımlar işleniyor...', 10);
      let uploadedCount = 0;
      const newDesigns: DesignItem[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          const optimized = await optimizeDesignImage(file, 2000);
          newDesigns.push({
            id: 'design-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4) + i,
            name: file.name.replace(/\.[^/.]+$/, ''),
            src: optimized.url || optimized.dataUrl,
            targetApparel: 'light',
            isSelected: false,
            width: optimized.width,
            height: optimized.height,
            folderId: activeDesignFolderId || undefined,
          });
          uploadedCount++;
          const percent = Math.round(((i + 1) / fileArray.length) * 100);
          toast.updateProgressToast(
            uploadToastId,
            percent,
            `${i + 1}/${fileArray.length} tasarım işlendi`
          );
        } catch (err) {
          console.error('Tasarım optimizasyon hatası:', err);
          toast.error(`'${file.name}' yüklenirken hata oluştu.`);
        }
      }

      if (newDesigns.length > 0) {
        setDesigns((prev) => {
          const slotFree = !prev.some((d) => d.isSelected && d.targetApparel === 'light');
          if (slotFree && newDesigns.length > 0) {
            newDesigns[0].isSelected = true;
          }
          return [...newDesigns, ...prev];
        });
      }

      toast.removeToast(uploadToastId);
      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} tasarım başarıyla yüklendi!`);
      }
      setIsOptimizing(false);
    },
    [activeDesignFolderId, setDesigns, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  return {
    isOptimizing,
    dragActive,
    handleFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
