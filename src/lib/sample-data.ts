import { MockupItem, DesignItem, MockupFolder, MockupPreset } from '@/types/pod';

export const DEFAULT_FOLDERS: MockupFolder[] = [];

export const SAMPLE_MOCKUPS: MockupItem[] = [];

export const SAMPLE_DESIGNS: DesignItem[] = [];

export const SAMPLE_PRESETS: MockupPreset[] = [];

export function isProtectedUrl(url: string): boolean {
  return false;
}
