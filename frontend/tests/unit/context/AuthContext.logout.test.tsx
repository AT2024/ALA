import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Thin mocks: only neutralize side effects (network, crypto, idle timer) so the
// behavior under test — sessionStorage cleanup on logout — runs for real.
vi.mock("@/services/authService", () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    validateToken: vi.fn().mockResolvedValue(false),
  },
}));
vi.mock("@/services/priorityService", () => ({
  priorityService: { clearCache: vi.fn() },
}));
vi.mock("@/services/encryptionKeyService", () => ({
  encryptionKeyService: {
    clearMaterial: vi.fn(),
    storeCredentialMaterial: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/services/sessionTestMode", () => ({
  setSessionTestMode: vi.fn(),
  getSessionTestMode: vi.fn().mockReturnValue(false),
}));
vi.mock("@/hooks/useIdleTimeout", () => ({
  useIdleTimeout: vi.fn(() => ({
    isWarningShown: false,
    secondsRemaining: 0,
    resetTimer: vi.fn(),
  })),
}));
vi.mock("@/services/api", () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import { AuthProvider, useAuth } from "@/context/AuthContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("logout", () => {
    it("clears treatment session data so a re-login in the same tab does not leak the previous user's applicator state", async () => {
      // Simulate an active treatment session left in storage by a prior user.
      sessionStorage.setItem("currentTreatment", '{"id":"T1"}');
      sessionStorage.setItem("processedApplicators", '[{"serial":"A1"}]');
      sessionStorage.setItem("availableApplicators", '[{"serial":"A2"}]');
      sessionStorage.setItem("individualSeedsRemoved", "5");

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      // Keys must match TreatmentContext.clearTreatment() (single source of truth).
      expect(sessionStorage.getItem("currentTreatment")).toBeNull();
      expect(sessionStorage.getItem("processedApplicators")).toBeNull();
      expect(sessionStorage.getItem("availableApplicators")).toBeNull();
      expect(sessionStorage.getItem("individualSeedsRemoved")).toBeNull();
    });
  });
});
