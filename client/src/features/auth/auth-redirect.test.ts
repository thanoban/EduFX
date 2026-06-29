import { describe, expect, it } from "vitest";

import {
  getOAuthErrorFallbackMessage,
  isRecoverableOAuthError,
  resolveAuthRedirectTarget,
} from "@/features/auth/auth-redirect";

describe("auth redirect helpers", () => {
  it("preserves callback query params and hash tokens from the home route", () => {
    expect(
      resolveAuthRedirectTarget(
        new URLSearchParams("code=abc123"),
        "#access_token=token-1&refresh_token=token-2",
      ),
    ).toBe("/auth/callback?code=abc123#access_token=token-1&refresh_token=token-2");
  });

  it("sends plain home traffic to login", () => {
    expect(resolveAuthRedirectTarget(new URLSearchParams(), "")).toBe("/login");
  });

  it("recognizes stale oauth state errors and returns a friendly fallback", () => {
    expect(isRecoverableOAuthError("bad_oauth_state", "OAuth state not found or expired")).toBe(true);
    expect(
      getOAuthErrorFallbackMessage("bad_oauth_state", "OAuth state not found or expired"),
    ).toBe("Google sign-in expired before EduFX could finish it. Please try again.");
  });
});
