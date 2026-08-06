export type ApparelType = 'light' | 'dark' | 'any';
export type TargetApparel = 'light' | 'dark' | 'both';
export type ExportFormatType = 'image/webp' | 'image/jpeg' | 'image/png';

export interface PrintArea {
  id: string;
  name: string;
  /** X position as percentage (0 - 100) */
  x: number;
  /** Y position as percentage (0 - 100) */
  y: number;
  /** Width as percentage (0 - 100) */
  width: number;
  /** Height as percentage (0 - 100) */
  height: number;
  /** Rotation angle in degrees (-180 to 180) */
  rotation: number;
}

export interface MockupFolder {
  id: string;
  name: string;
  isCustom?: boolean;
  type?: 'mockup' | 'design'; // if undefined, assume 'mockup'
}

export interface MockupItem {
  id: string;
  name: string;
  src: string;
  folderId: string;
  apparelType: ApparelType;
  printAreas: PrintArea[];
  opacity: number;
  width: number;
  height: number;

  /**
   * When false, the mockup is treated as a static visual asset (like size chart, color chart)
   * and print area placement is disabled during rendering.
   * Default: true
   */
  hasPrintArea?: boolean;

  /**
   * When true, this item is a video file (MP4, WebM, MOV) rather than a still image.
   */
  isVideo?: boolean;
  mimeType?: string;
}

export interface DesignItem {
  id: string;
  name: string;
  src: string;
  targetApparel: TargetApparel;
  isSelected?: boolean;
  width: number;
  height: number;
  folderId?: string; // Optional for backward compatibility and "Tüm Tasarımlar"
}

export interface MockupPreset {
  id: string;
  title: string;
  apparelType: ApparelType;
  printArea: Omit<PrintArea, 'id' | 'name'>;
}

export interface RenderedMatch {
  id: string;
  mockupId: string;
  mockupName: string;
  mockupApparel: ApparelType;
  folderId: string;
  folderName?: string;
  folderOrderIndex?: number;
  designId: string;
  designName: string;
  designTarget: TargetApparel;
  previewUrl: string;
  exportFileName: string;
  format: ExportFormatType;
  isVideo?: boolean;
  mimeType?: string;
}
