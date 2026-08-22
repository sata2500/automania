import { useCallback } from 'react';
import { MockupItem, ApparelType, PrintArea, MockupFolder } from '@/types/pod';
import { optimizeMockupImage } from '@/lib/image-optimizer';
import { optimizeVideoFile } from '@/lib/video-optimizer';
import { getDurationWithFFmpeg } from '@/lib/ffmpeg-service';
import { useToast } from '@/components/common/ToastContext';

interface UseMockupUploadProps {
  mockups: MockupItem[];
  setMockups: React.Dispatch<React.SetStateAction<MockupItem[]>>;
  mockupFolders: MockupFolder[];
  activeFolderId: string | null;
  draftApparelType: ApparelType;
  draftAreas: PrintArea[];
  setSelectedMockupId: (id: string | null) => void;
}

export function useMockupUpload({
  mockups,
  setMockups,
  mockupFolders,
  activeFolderId,
  draftApparelType,
  draftAreas,
  setSelectedMockupId,
}: UseMockupUploadProps) {
  const toast = useToast();

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.style.display = 'none';
      document.body.appendChild(video);

      const cleanup = () => {
        video.onloadedmetadata = null;
        video.ondurationchange = null;
        video.onerror = null;
        window.URL.revokeObjectURL(video.src);
        if (document.body.contains(video)) document.body.removeChild(video);
      };

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const checkDuration = () => {
        if (video.duration && video.duration !== Infinity && !isNaN(video.duration)) {
          const dur = video.duration;
          cleanup();
          resolve(dur);
        }
      };

      video.onloadedmetadata = checkDuration;
      video.ondurationchange = checkDuration;

      video.onerror = () => {
        cleanup();
        reject(new Error('Desteklenmeyen veya bozuk video formatı. FFmpeg fallback denenecek.'));
      };

      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const getVideoDurationWithFallback = async (file: File): Promise<number> => {
    try {
      return await getVideoDuration(file);
    } catch (e) {
      console.log('Native süre hesabı başarısız, FFmpeg.wasm indiriliyor...', e);
      toast.info('Video formatı desteklenmiyor. FFmpeg WASM motoru ile okunuyor (Lütfen bekleyin)...');
      try {
        return await getDurationWithFFmpeg(file);
      } catch (ffErr) {
        throw new Error('Video süresi hem tarayıcı hem FFmpeg tarafından okunamadı.');
      }
    }
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const targetFolder = activeFolderId || mockupFolders[0]?.id || 'folder-women';

      const existingInFolder = mockups.filter((m) => m.folderId === targetFolder);
      let currentImageCount = existingInFolder.filter((m) => !m.isVideo).length;
      let currentVideoCount = existingInFolder.filter((m) => m.isVideo).length;

      const fileList = Array.from(files);
      let addedCount = 0;
      let optimizedImageCount = 0;
      let webpImageCount = 0;
      let fallbackImageCount = 0;
      let savedBytesTotal = 0;
      const uploadToastId = toast.progress('Görseller yükleniyor ve işleniyor...', 10);

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        try {
          const isVideo =
            file.type.startsWith('video/') ||
            /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);

          if (isVideo) {
            if (file.size > 100 * 1024 * 1024) {
              toast.warning(
                `'${file.name}' çok büyük! Etsy maksimum 100 MB video boyutuna izin vermektedir.`
              );
              continue;
            }
            if (currentVideoCount >= 1) {
              toast.warning(`'${file.name}' eklenemedi! Klasörde en fazla 1 video yüklenebilir.`);
              continue;
            }
            try {
              const duration = await getVideoDurationWithFallback(file);
              if (duration > 15.5) {
                toast.warning(
                  `'${file.name}' çok uzun! Etsy en fazla 15 saniyelik videolara izin vermektedir (Şu an: ${Math.round(duration)}sn).`
                );
                continue;
              }
            } catch (e) {
              toast.error(
                `'${file.name}' okunamadı: FFmpeg motoru bile bu video formatını çözümleyemedi.`
              );
              continue;
            }
            currentVideoCount++;
          } else {
            if (file.size > 20 * 1024 * 1024) {
              toast.warning(`'${file.name}' çok büyük! Lütfen 20 MB'dan küçük görseller yükleyin.`);
              continue;
            }
            if (currentImageCount >= 20) {
              toast.warning(
                `'${file.name}' eklenemedi! Etsy güncel (2026) kısıtlamalarına göre maksimum 20 görsel sınırına sahiptir.`
              );
              continue;
            }
            currentImageCount++;
          }

          let srcUrl: string;
          let imgWidth = 2000;
          let imgHeight = 2000;
          let mimeType = isVideo ? 'video/mp4' : 'image/webp';

          if (isVideo) {
            const optimizedVideo = await optimizeVideoFile(file);
            srcUrl = optimizedVideo.url || optimizedVideo.dataUrl;
            mimeType = optimizedVideo.mimeType || 'video/mp4';

            if (optimizedVideo.originalSize && optimizedVideo.optimizedSize) {
              const savedBytes = optimizedVideo.originalSize - optimizedVideo.optimizedSize;
              if (savedBytes > 0) {
                const savedMb = (savedBytes / (1024 * 1024)).toFixed(1);
                const percent = ((savedBytes / optimizedVideo.originalSize) * 100).toFixed(0);
                toast.success(`Video optimize edildi: %${percent} küçültüldü (${savedMb}MB tasarruf) 🚀`);
              }
            }
          } else {
            const optimized = await optimizeMockupImage(file, 2000, 0.90);
            optimizedImageCount++;
            if (optimized.mimeType === 'image/webp') webpImageCount++;
            else fallbackImageCount++;
            savedBytesTotal += Math.max(0, optimized.originalSize - optimized.optimizedSize);
            srcUrl = optimized.url || optimized.dataUrl;
            imgWidth = optimized.width;
            imgHeight = optimized.height;
          }

          const defaultAreas: PrintArea[] = [
            {
              id: 'area-1',
              name: 'Ana Baskı Alanı',
              x: 33,
              y: 30,
              width: 34,
              height: 40,
              rotation: 0,
            },
          ];

          const newMockup: MockupItem = {
            id: 'mockup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: file.name.replace(/\.[^/.]+$/, ''),
            src: srcUrl,
            folderId: targetFolder,
            apparelType: draftApparelType,
            printAreas: isVideo ? [] : structuredClone(draftAreas.length ? draftAreas : defaultAreas),
            opacity: 1.0,
            width: imgWidth,
            height: imgHeight,
            hasPrintArea: !isVideo,
            isVideo,
            mimeType,
          };

          setMockups((prev) => [...prev, newMockup]);
          setSelectedMockupId(newMockup.id);
          addedCount++;

          const percent = Math.round(((i + 1) / fileList.length) * 100);
          toast.updateProgressToast(
            uploadToastId,
            percent,
            `${i + 1}/${fileList.length} dosya yüklendi`
          );
        } catch (err) {
          console.error('Mockup/Video optimizasyon hatası:', err);
          toast.error(`'${file.name}' yüklenirken hata oluştu.`);
        }
      }

      toast.removeToast(uploadToastId);
      if (optimizedImageCount > 0) {
        const savedMb = (savedBytesTotal / (1024 * 1024)).toFixed(1);
        const formatMessage = fallbackImageCount > 0
          ? `${webpImageCount} WebP, ${fallbackImageCount} tarayıcı fallback formatı`
          : 'WebP';
        toast.success(`${optimizedImageCount} mockup optimize edildi (${formatMessage}); toplam ${savedMb} MB tasarruf.`);
      }
      if (addedCount > 0) {
        toast.success(`${addedCount} dosya başarıyla klasöre yüklendi!`);
      }
      // Reset input value
      e.target.value = '';
    },
    [
      activeFolderId,
      mockupFolders,
      mockups,
      draftApparelType,
      draftAreas,
      setMockups,
      setSelectedMockupId,
      toast,
    ]
  );

  return { handleFileUpload };
}
