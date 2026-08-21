import { MockupItem, DesignItem, MockupFolder, MockupPreset } from '@/types/pod';

const DEMO_ASSET_PATHS = [
  '/demo/mockup-light.svg',
  '/demo/mockup-dark.svg',
  '/demo/design-sun.svg',
  '/demo/design-mountain.svg',
] as const;

export const DEFAULT_FOLDERS: MockupFolder[] = [
  { id: 'demo-folder-light', name: 'Light Apparel', isCustom: false, type: 'mockup' },
  { id: 'demo-folder-dark', name: 'Dark Apparel', isCustom: false, type: 'mockup' },
  { id: 'demo-folder-designs', name: 'Demo Designs', isCustom: false, type: 'design' },
];

export const SAMPLE_MOCKUPS: MockupItem[] = [
  {
    id: 'demo-mockup-light',
    name: 'Minimal Light T-Shirt',
    src: '/demo/mockup-light.svg',
    folderId: 'demo-folder-light',
    apparelType: 'light',
    printAreas: [{ id: 'demo-area-light', name: 'Main Print Area', x: 37.9, y: 39.2, width: 24.2, height: 20.8, rotation: 0 }],
    opacity: 1,
    width: 1200,
    height: 1200,
    hasPrintArea: true,
    exportAspect: 'square',
  },
  {
    id: 'demo-mockup-dark',
    name: 'Minimal Dark T-Shirt',
    src: '/demo/mockup-dark.svg',
    folderId: 'demo-folder-dark',
    apparelType: 'dark',
    printAreas: [{ id: 'demo-area-dark', name: 'Main Print Area', x: 37.9, y: 39.2, width: 24.2, height: 20.8, rotation: 0 }],
    opacity: 1,
    width: 1200,
    height: 1200,
    hasPrintArea: true,
    exportAspect: 'square',
  },
];

export const SAMPLE_DESIGNS: DesignItem[] = [
  {
    id: 'demo-design-sun',
    name: 'Keep Going Sunrise',
    src: '/demo/design-sun.svg',
    targetApparel: 'both',
    isSelected: true,
    width: 1200,
    height: 1200,
    folderId: 'demo-folder-designs',
  },
  {
    id: 'demo-design-mountain',
    name: 'Wander More Mountain',
    src: '/demo/design-mountain.svg',
    targetApparel: 'both',
    isSelected: true,
    width: 1200,
    height: 1200,
    folderId: 'demo-folder-designs',
  },
];

export const SAMPLE_PRESETS: MockupPreset[] = [];

export function isProtectedUrl(url: string): boolean {
  return DEMO_ASSET_PATHS.some((assetPath) => url === assetPath || url.endsWith(assetPath));
}
