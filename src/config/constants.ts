/**
 * Application Constants
 * =====================
 * Single source of truth for all hardcoded values across the codebase.
 * Import from here instead of duplicating string literals in components.
 */

// ─── LocalStorage / IndexedDB Keys ───────────────────────────────────────────

export const STORAGE_KEYS = {
  USER_SESSION: 'automania_pod_user_session',
  USER_LIST: 'automania_pod_user_list_v1',
  THEME_PREFERENCE: 'automania_pod_theme_preference',
  ACTIVE_TAB: 'automania_pod_active_tab_v1',
  LISTINGS_VIEW: 'automania_listings_view',
  GUEST_BANNER_DISMISSED: 'automania_guest_banner_dismissed',
  EMPTY_WORKSPACE_DISMISSED: 'automania_empty_workspace_dismissed',
  PWA_BANNER_DISMISSED: 'automania_pwa_banner_dismissed',
  OPENROUTER_API_KEY: 'automania_openrouter_api_key',
  MODEL_VISION: 'automania_model_vision',
  MODEL_REASONING: 'automania_model_reasoning',
  MODEL_GENERATION: 'automania_model_generation',
} as const;

// ─── Timing & Thresholds ─────────────────────────────────────────────────────

export const TIMING = {
  /** Polling interval for cross-device sync (ms) */
  SYNC_POLL_INTERVAL_MS: 30_000,
  /** Odak/görünürlük değişiminde iki kontrol arasındaki en kısa süre. */
  SYNC_FOCUS_MIN_GAP_MS: 3_000,
  /** Debounce delay for auto-save to server (ms) */
  SAVE_DEBOUNCE_MS: 400,
  /** Debounce delay for local IndexedDB UI state saves (ms) */
  UI_STATE_DEBOUNCE_MS: 200,
  /** Clock drift buffer for optimistic concurrency (ms) */
  SYNC_CLOCK_DRIFT_MS: 2000,
} as const;
