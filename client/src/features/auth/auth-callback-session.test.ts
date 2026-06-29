import { describe, expect, it, vi } from "vitest";

import { readCallbackTokens, resolveCallbackAccessToken } from "@/features/auth/auth-callback-session";

function createSupabaseClientMock(overrides?: {
  exchangeCodeForSession?: () => Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }>;
  setSession?: () => Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }>;
}) {
  return {
    auth: {
      exchangeCodeForSession:
        overrides?.exchangeCodeForSession ??
        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getSession:
        overrides?.getSession ??
        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      setSession:
        overrides?.setSession ??
        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  };
}

describe("auth callback token resolution", () => {
  it("reads callback tokens and errors from query and hash params", () => {
    const tokens = readCallbackTokens(
      new URLSearchParams("code=abc123"),
      "#access_token=token-1&refresh_token=token-2",
    );

    expect(tokens).toEqual({
      accessToken: "token-1",
      code: "abc123",
      error: null,
      refreshToken: "token-2",
    });
  });

  it("applies hash tokens before reading an existing session", async () => {
    const onHashTokensApplied = vi.fn();
    const setSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "hash-access-token" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "should-not-be-used" } },
      error: null,
    });
    const client = createSupabaseClientMock({ setSession, getSession });

    const result = await resolveCallbackAccessToken(
      new URLSearchParams(),
      "#access_token=hash-access-token&refresh_token=refresh-token",
      client,
      onHashTokensApplied,
    );

    expect(result).toEqual({ accessToken: "hash-access-token", error: null });
    expect(setSession).toHaveBeenCalledOnce();
    expect(getSession).not.toHaveBeenCalled();
    expect(onHashTokensApplied).toHaveBeenCalledOnce();
  });

  it("falls back to an existing session when the exchange response is empty", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "existing-session-token" } },
      error: null,
    });
    const client = createSupabaseClientMock({ exchangeCodeForSession, getSession });

    const result = await resolveCallbackAccessToken(
      new URLSearchParams("code=oauth-code"),
      "",
      client,
    );

    expect(result).toEqual({ accessToken: "existing-session-token", error: null });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(getSession).toHaveBeenCalledOnce();
  });
});
