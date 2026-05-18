/**
 * Test Mode is a per-session choice held ONLY in memory. It must never be
 * persisted (localStorage/sessionStorage), so a fresh page load / new JS
 * context always starts in normal mode and the admin is re-asked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSessionTestMode,
  setSessionTestMode,
} from "@/services/sessionTestMode";

describe("sessionTestMode", () => {
  beforeEach(() => {
    setSessionTestMode(false);
    localStorage.clear();
  });

  it("defaults to false (normal mode) before any choice is made", () => {
    expect(getSessionTestMode()).toBe(false);
  });

  it("reflects the chosen mode in memory", () => {
    setSessionTestMode(true);
    expect(getSessionTestMode()).toBe(true);
    setSessionTestMode(false);
    expect(getSessionTestMode()).toBe(false);
  });

  it("never writes the choice to localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    setSessionTestMode(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
