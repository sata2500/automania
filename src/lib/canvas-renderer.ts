import { MockupItem, DesignItem, ExportFormatType } from '@/types/pod';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export interface RenderOptions {
  outputWidth?: number;
  outputHeight?: number;
  quality?: number;
  outputFormat?: ExportFormatType;
}

/**
 * Renders a design onto a mockup.
 * Composites each design into its print area(s) with opacity and rotation support.
 * Static chart images and videos are returned as-is.
 * 100% offline. No external APIs.
 */
export async function renderMockupWithDesign(
  mockup: MockupItem,
  design: DesignItem,
  options: RenderOptions = {}
): Promise<string> {
  // If this item is a video file, return video URL directly
  if (mockup.isVideo) {
    return mockup.src;
  }

  const mockupImg = await loadImage(mockup.src);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context could not be created');

  const origW = mockupImg.naturalWidth || mockup.width || 2000;
  const origH = mockupImg.naturalHeight || mockup.height || 2000;

  canvas.width = options.outputWidth || origW;
  canvas.height = options.outputHeight || origH;

  // 1. Draw base mockup / chart image
  ctx.drawImage(mockupImg, 0, 0, canvas.width, canvas.height);

  const format = options.outputFormat || 'image/webp';
  const quality = options.quality ?? 0.95;

  // If this item is a static visual (size chart, color chart) or has no print area, return base image directly
  const isStaticAsset = mockup.hasPrintArea === false || !mockup.printAreas || mockup.printAreas.length === 0;
  if (isStaticAsset) {
    return canvas.toDataURL(format, quality);
  }

  // 2. Process design overlay for each print area cleanly
  const designImg = await loadImage(design.src);
  const areas = mockup.printAreas;

  const dW = designImg.naturalWidth || design.width || 1000;
  const dH = designImg.naturalHeight || design.height || 1000;
  const designRatio = dW / dH;

  for (const area of areas) {
    const printBoxX = (area.x / 100) * canvas.width;
    const printBoxY = (area.y / 100) * canvas.height;
    const printBoxW = (area.width / 100) * canvas.width;
    const printBoxH = (area.height / 100) * canvas.height;
    const rotationDeg = area.rotation || 0;

    // Fit design into print box maintaining aspect ratio
    const boxRatio = printBoxW / printBoxH;
    let drawW: number, drawH: number;
    if (designRatio > boxRatio) {
      drawW = printBoxW;
      drawH = printBoxW / designRatio;
    } else {
      drawH = printBoxH;
      drawW = printBoxH * designRatio;
    }

    const centerX = printBoxX + printBoxW / 2;
    const centerY = printBoxY + printBoxH / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.globalAlpha = mockup.opacity ?? 1.0;
    ctx.drawImage(designImg, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  return canvas.toDataURL(format, quality);
}

export function generateMatchingPairs(
  mockups: MockupItem[],
  designs: DesignItem[],
  activeFolderId: string | null = null
): { mockup: MockupItem; design: DesignItem }[] {
  const filteredMockups = activeFolderId
    ? mockups.filter((m) => m.folderId === activeFolderId)
    : mockups;

  const activeDesigns = designs.filter((d) => d.isSelected);

  const pairs: { mockup: MockupItem; design: DesignItem }[] = [];

  for (const mockup of filteredMockups) {
    const isStaticAsset = mockup.isVideo || mockup.hasPrintArea === false || !mockup.printAreas || mockup.printAreas.length === 0;

    if (isStaticAsset) {
      // Static charts and videos have no print area so they do NOT multiply per design.
      // Output exactly ONCE per static asset.
      const refDesign = activeDesigns[0] || {
        id: 'static-ref',
        name: '',
        src: '',
        targetApparel: 'both',
        width: 1000,
        height: 1000,
      };
      pairs.push({ mockup, design: refDesign as DesignItem });
    } else {
      for (const design of activeDesigns) {
        let isMatch = false;
        if (mockup.apparelType === 'any' || design.targetApparel === 'both') {
          isMatch = true;
        } else if (mockup.apparelType === 'light' && design.targetApparel === 'dark') {
          isMatch = true;
        } else if (mockup.apparelType === 'dark' && design.targetApparel === 'light') {
          isMatch = true;
        }
        if (isMatch) pairs.push({ mockup, design });
      }
    }
  }

  return pairs;
}
