import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { RenderedMatch, ExportFormatType } from '@/types/pod';

export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function formatExportFileName(
  designName: string,
  mockupName: string,
  folderName: string = '',
  orderIndex: number = 1,
  format: ExportFormatType = 'image/webp',
  isStaticAsset: boolean = false,
  isVideo: boolean = false,
  videoExt: string = 'mp4'
): string {
  const sanitize = (str: string) => str.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, '_').replace(/_+/g, '_').trim();
  const cleanDesign = sanitize(designName);
  const cleanMockup = sanitize(mockupName);
  const cleanFolder = folderName ? sanitize(folderName) : '';
  const ext = isVideo ? (videoExt || 'mp4') : (format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg');

  const prefix = `${orderIndex}_${cleanFolder ? cleanFolder + '_' : ''}`;

  if (isStaticAsset || isVideo) {
    return `${prefix}${cleanMockup}.${ext}`;
  }

  return `${prefix}${cleanMockup}_${cleanDesign}.${ext}`;
}

export async function getBlobFromUrl(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    return dataURLtoBlob(url);
  }
  const res = await fetch(url);
  return await res.blob();
}

export async function downloadMatchesAsZip(
  matches: RenderedMatch[],
  zipFileName: string = 'etsy_mockups.zip',
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('etsy_mockups');

  if (!folder) {
    throw new Error('Failed to create ZIP folder');
  }

  const total = matches.length;

  for (let i = 0; i < total; i++) {
    const match = matches[i];
    const blob = await getBlobFromUrl(match.previewUrl);
    folder.file(match.exportFileName, blob);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 50));
    }
  }

  const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(50 + Math.round(metadata.percent / 2));
    }
  });

  saveAs(zipContent, zipFileName);
}
