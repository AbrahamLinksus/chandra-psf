export const LINK_EXPIRY_DAYS = 7;
export const TEXT_MAX_LENGTH = 1000;
export const DEFAULT_RANGE_DAYS = 30;
export const RECENT_COMMENTS = 10;
export const MIN_PASSWORD_LENGTH = 8;
export const AUTO_RESOLVE_NOTE = "Auto-resolved: no alert reason after edit";
export const SYSTEM_ACTOR = "system";

// Phase 2: sessions (LLD-phase2 §18.2)
export const SUPPORT_IDLE_HOURS = 2;
export const ADMIN_IDLE_HOURS = 12;
export const SESSION_MAX_DAYS = 7;

// Phase 2: sign-in lockout and rate limits (§18.3, §21)
export const LOCKOUT_WINDOW_MINUTES = 15;
export const LOCKOUT_EMAIL_FAILURES = 5;
export const SIGN_IN_IP_FAILURES = 30;
export const LINK_OPEN_LIMIT_PER_HOUR = 30;
export const LINK_SUBMIT_LIMIT_PER_HOUR = 5;

// Phase 2: retention (SPEC US-31, §25)
export const RETENTION_UNANSWERED_DAYS = 90;
export const RETENTION_ANSWERED_YEARS = 3;
export const DELETED_PURGE_DAYS = 30;
export const ATTEMPTS_RETENTION_HOURS = 24;
export const CLEANUP_BATCH_SIZE = 500;
export const CLEANUP_BUDGET_SECONDS = 240;

// Phase 2: job card input (SPEC F-2)
export const SERVICE_DATE_MAX_AGE_DAYS = 60;
export const JOB_CARD_NO_MIN = 3;
export const JOB_CARD_NO_MAX = 20;
export const CUSTOMER_NAME_MAX = 80;
export const REG_NO_MIN = 6;
export const REG_NO_MAX = 12;
