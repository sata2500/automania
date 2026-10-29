import { useState, useCallback } from 'react';
import { DesignItem } from '@/types/pod';
import { optimizeDesignImage } from '@/lib/image-optimizer';
import { useToast } from '@/components/common/ToastContext';

interface UseDesignUploadProps {
  setDesigns: React.Dispatch<React.SetStateAction<DesignItem[]>>;
}

export function useDesignUpload({ setDesigns }: UseDesignUploadProps) {
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

      const uploadToastId = toast.progress('Tasarımlar optimize ediliyor...', 10);
      let uploadedCount = 0;
      let savedBytesTotal = 0;
      const newDesigns: DesignItem[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          // Sunucuda saydam boşlukları kırpılıp kayıpsız sıkıştırılmış PNG (çözünürlük ve saydamlık korunur)
          const optimized = await optimizeDesignImage(file);
          // Dosya doğrudan sunucuda işlendiyse ölçüler kırpılmış hâlindir; tarayıcı yedeğinden geçenler
          // Tasarımlar sekmesindeki arka plan bakımıyla bir kez daha işlenir (ölçüler de düzelir).
          const serverProcessed = !optimized.dataUrl && Boolean(optimized.url);
          savedBytesTotal += Math.max(0, optimized.originalSize - optimized.optimizedSize);
          newDesigns.push({
            id: 'design-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + i,
            name: file.name.replace(/\.[^/.]+$/, ''),
            src: optimized.url || optimized.dataUrl,
            // Yeni tasarım varsayılan olarak tüm kumaşlarla eşleşir; kullanıcı kartta daraltabilir.
            targetApparel: 'both',
            isSelected: false,
            width: optimized.width,
            height: optimized.height,
            createdAt: Date.now(),
            ...(serverProcessed ? { optimizedAt: Date.now() } : {}),
          });
          uploadedCount++;

          const percent = Math.round(((i + 1) / fileArray.length) * 100);
          toast.updateProgressToast(
            uploadToastId,
            percent,
            `${i + 1}/${fileArray.length} tasarım optimize edildi`
          );
        } catch (err) {
          console.error('Tasarım optimizasyon hatası:', err);
          toast.error(`'${file.name}' yüklenirken hata oluştu.`);
        }
      }

      if (newDesigns.length > 0) {
        setDesigns((prev) => {
          // "Tüm kumaşlar" slotu boşsa ilk tasarım üretime alınır (dış diziyi değiştirmeden).
          const slotFree = !prev.some((d) => d.isSelected && d.targetApparel === 'both');
          const added = slotFree ? newDesigns.map((d, i) => (i === 0 ? { ...d, isSelected: true } : d)) : newDesigns;
          return [...added, ...prev];
        });
      }

      toast.removeToast(uploadToastId);
      if (uploadedCount > 0) {
        const savedMb = (savedBytesTotal / (1024 * 1024)).toFixed(1);
        toast.success(`${uploadedCount} tasarım yüklendi; boşlukları kırpıldı ve kayıpsız PNG olarak saklandı (${savedMb} MB tasarruf).`);
      }
      setIsOptimizing(false);
    },
    [setDesigns, toast]
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
