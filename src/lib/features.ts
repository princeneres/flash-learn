// Centralized feature flags. Flip a flag here to toggle a whole feature across
// the app without hunting down every call-site.

// Monetization (Pro plans + AI credit purchase via AbacatePay) is paused for now.
// When this is false the plan/credit purchase UI is hidden everywhere; the
// underlying services and edge functions are left untouched so re-enabling is a
// one-line change.
export const MONETIZATION_ENABLED = false;
