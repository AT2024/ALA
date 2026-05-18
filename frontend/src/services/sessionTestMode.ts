/**
 * In-memory, per-session Test Mode flag.
 *
 * Test Mode (simulated patient/applicator data) is a deliberate, admin-only
 * choice made on the mode-selection screen. It is intentionally NOT persisted
 * to localStorage/sessionStorage or the database: a full page reload starts a
 * new JS context where this resets to `false`, so the admin is always re-asked
 * and the production app never silently runs on simulated data.
 *
 * The axios request interceptor reads this to attach the `X-Test-Mode` header.
 */
let sessionTestMode = false;

export function getSessionTestMode(): boolean {
  return sessionTestMode;
}

export function setSessionTestMode(enabled: boolean): void {
  sessionTestMode = enabled;
}
