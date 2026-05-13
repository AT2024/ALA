import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Mock the heavy collaborators so we can isolate the logout sessionStorage
// cleanup behavior. We are not testing authService / priorityService /
// encryptionKeyService here — only that AuthContext.logout() also clears
// the four treatment-related session keys, so a re-login in the same tab
// cannot restore a previous user's applicator status.

vi.mock("@/services/authService", () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    checkAuthStatus: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/services/priorityService", () => ({
  priorityService: {
    clearCache: vi.fn(),
  },
}));

vi.mock("@/services/encryptionKeyService", () => ({
  encryptionKeyService: {
    clearMaterial: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock("@/hooks/useIdleTimeout", () => ({
  useIdleTimeout: () => ({
    isWarningShown: false,
    secondsRemaining: 0,
    dismissWarning: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
);

// Keys that AuthContext.logout() must clear from sessionStorage.
// These must match TreatmentContext.clearTreatment() — single source of truth.
const TREATMENT_SESSION_KEYS = [
  "currentTreatment",
  "processedApplicators",
  "availableApplicators",
  "individualSeedsRemoved",
];

const PRE_EXISTING_KEYS = ["loginIdentifier", "priorityUserData"];

describe("AuthContext.logout — session cleanup (regression)", () => {
  beforeEach(() => {
    // Pre-populate sessionStorage with stale data from a previous session.
    // This is the EXACT state that caused the bug: User A logs out, User B
    // logs back in in the same tab, sees A's applicator status.
    sessionStorage.setItem(
      "currentTreatment",
      JSON.stringify({ id: "stale-treatment-user-A" }),
    );
    sessionStorage.setItem(
      "processedApplicators",
      JSON.stringify([{ serialNumber: "USERA-001", status: "INSERTED" }]),
    );
    sessionStorage.setItem(
      "availableApplicators",
      JSON.stringify([{ serialNumber: "USERA-002" }]),
    );
    sessionStorage.setItem("individualSeedsRemoved", "12");
    sessionStorage.setItem("loginIdentifier", "userA@example.com");
    sessionStorage.setItem(
      "priorityUserData",
      JSON.stringify({ custName: "stale" }),
    );
    localStorage.setItem("user", JSON.stringify({ id: "userA" }));
  });

  it("removes the 4 treatment session keys when logout() is called", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for the initial auth-check effect to settle so isLoading is false.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Sanity: the keys are present BEFORE logout. Without this baseline
    // a green test could just mean afterEach already cleared storage.
    for (const key of TREATMENT_SESSION_KEYS) {
      expect(sessionStorage.getItem(key)).not.toBeNull();
    }

    await act(async () => {
      await result.current.logout();
    });

    // The bug-fix assertion: each treatment key is gone after logout.
    for (const key of TREATMENT_SESSION_KEYS) {
      expect(sessionStorage.getItem(key)).toBeNull();
    }
  });

  it("also clears the pre-existing auth session keys (no regression in old behavior)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    for (const key of PRE_EXISTING_KEYS) {
      expect(sessionStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("does not throw if the treatment keys were never set", async () => {
    sessionStorage.removeItem("currentTreatment");
    sessionStorage.removeItem("processedApplicators");
    sessionStorage.removeItem("availableApplicators");
    sessionStorage.removeItem("individualSeedsRemoved");

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.logout();
      }),
    ).resolves.toBeUndefined();
  });
});
