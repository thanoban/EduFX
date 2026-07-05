import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/features/auth/auth-provider";
import { AuthCallbackScreen } from "@/features/auth/auth-callback-screen";

const replace = vi.fn();
let searchParams = new URLSearchParams("code=oauth-code");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return {
      auth: {
        exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
        getSession: (...args: unknown[]) => getSession(...args),
        setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    };
  },
}));

function renderCallback(signInWithGoogle: () => Promise<void>) {
  return render(
    <AuthContext.Provider
      value={{
        student: null,
        token: null,
        loading: false,
        authError: null,
        authenticateWithAccessToken: vi.fn(),
        signInDemo: vi.fn(),
        signInWithGoogle,
        signInWithEmail: vi.fn(),
        signUpWithEmail: vi.fn(),
        signOut: vi.fn(),
        refreshStatus: vi.fn(),
        updateStudentProfile: vi.fn(),
      }}
    >
      <AuthCallbackScreen />
    </AuthContext.Provider>,
  );
}

describe("AuthCallbackScreen PKCE auto-retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    searchParams = new URLSearchParams("code=oauth-code");
    exchangeCodeForSession.mockReset();
    getSession.mockReset();
    replace.mockReset();
    // No existing session ever shows up, so the component's 5s poll for an
    // auto-detected session (via detectSessionInUrl) always runs to its
    // timeout before falling through to the manual exchange below.
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "PKCE code verifier not found in storage" },
    });
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("automatically retries once instead of showing the error card", async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    renderCallback(signInWithGoogle);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(signInWithGoogle).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem("edufx.mvc.oauth-callback-auto-retried")).toBe("1");
  });

  it("shows the error card if the retry budget is already spent", async () => {
    window.sessionStorage.setItem("edufx.mvc.oauth-callback-auto-retried", "1");
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    renderCallback(signInWithGoogle);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(
      screen.getByText("Google sign-in expired before EduFX could finish it. Please try again."),
    ).toBeInTheDocument();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });
});
