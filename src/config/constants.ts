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
  GUEST_BANNER_DISMISSED: 'automania_guest_banner_dismissed',
  EMPTY_WORKSPACE_DISMISSED: 'automania_empty_workspace_dismissed',
  PWA_BANNER_DISMISSED: 'automania_pwa_banner_dismissed',
  OPENROUTER_API_KEY: 'automania_openrouter_api_key',
  MODEL_VISION: 'automania_model_vision',
  MODEL_REASONING: 'automania_model_reasoning',
  MODEL_GENERATION: 'automania_model_generation',
} as const;

// ─── IndexedDB Keys (per-user prefixed) ──────────────────────────────────────

export const IDB_KEY_SUFFIXES = {
  MOCKUPS: 'automania_pod_mockups_v1',
  DESIGNS: 'automania_pod_designs_v1',
  FOLDERS: 'automania_pod_folders_v1',
  ACTIVE_FOLDER: 'automania_pod_active_folder_v1',
  SELECTED_MOCKUP: 'automania_pod_selected_mockup_v1',
  ACTIVE_DESIGN_FOLDER: 'automania_pod_active_design_folder_v1',
  HAS_INITIALIZED: 'automania_pod_has_init_v1',
  ETSY_PRODUCT_TYPES: 'automania_etsy_product_types_v1',
  ETSY_USER_NOTES: 'automania_etsy_user_notes_v1',
} as const;

// ─── Timing & Thresholds ─────────────────────────────────────────────────────

export const TIMING = {
  /** Polling interval for cross-device sync (ms) */
  SYNC_POLL_INTERVAL_MS: 5000,
  /** Debounce delay for auto-save to server (ms) */
  SAVE_DEBOUNCE_MS: 400,
  /** Debounce delay for local IndexedDB UI state saves (ms) */
  UI_STATE_DEBOUNCE_MS: 200,
  /** Clock drift buffer for optimistic concurrency (ms) */
  SYNC_CLOCK_DRIFT_MS: 2000,
} as const;

// ─── UI Thresholds ───────────────────────────────────────────────────────────

export const UI = {
  /** Minimum swipe distance to trigger tab change (px) */
  SWIPE_THRESHOLD_PX: 80,
  /** Maximum count shown in badge (shows "99+" above this) */
  BADGE_MAX_COUNT: 99,
  /** Maximum number of toast notifications shown simultaneously */
  TOAST_MAX_VISIBLE: 5,
} as const;

// ─── Canvas / Export ─────────────────────────────────────────────────────────

export const CANVAS = {
  /** Final crop output resolution (square) */
  CROP_OUTPUT_SIZE_PX: 1500,
  /** Low-resolution preview during interactive slider drag */
  CROP_PREVIEW_SIZE_PX: 300,
  /** Vercel serverless payload limit with safety margin */
  SERVER_PAYLOAD_LIMIT_BYTES: 3.8 * 1024 * 1024,
} as const;

// ─── Toast Durations (ms) ────────────────────────────────────────────────────

export const TOAST_DURATION = {
  success: 3500,
  error: 5000,
  info: 4000,
  warning: 4500,
  progress: 0, // progress toasts are manually dismissed
} as const;

// ─── Avatar ──────────────────────────────────────────────────────────────────

export const AVATAR_BASE_URL = 'https://api.dicebear.com/7.x/bottts/svg';
