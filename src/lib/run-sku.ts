import type { AutomationRunSteps, ListingReviewState } from '@/types/templates';

/**
 * Bir otomasyon/ilan kaydının SKU'su: incelemede elle değiştirilen değer önce gelir; yoksa otomasyonun
 * tasarım adımında üretilen ya da İlan Stüdyosu'ndan gelen SKU.
 */
export function runSkuOf(steps: unknown): string | null {
  const s = (steps ?? {}) as AutomationRunSteps;
  const output = s.listingCreation?.output as { review?: ListingReviewState; manualListing?: { sku?: string } } | undefined;
  const candidates = [
    output?.review?.sku,
    s.backgroundRemoval?.output?.sku,
    s.designGeneration?.output?.sku,
    output?.manualListing?.sku,
  ];
  const sku = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return sku ?? null;
}
