import { afterEach, describe, expect, it, vi } from "vitest";

import { progressApi } from "@/lib/api";
import { AUTH_EXPIRED_EVENT, STORAGE_KEYS } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

describe("API client", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends the stored bearer token for student API calls", async () => {
    writeStorage(STORAGE_KEYS.token, "token-123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: { student_id: 7, progress: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await progressApi.getAll(7);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/progress/7",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      }),
    );
  });

  it("clears cached auth and notifies the app when the token is expired", async () => {
    writeStorage(STORAGE_KEYS.token, "expired-token");
    writeStorage(STORAGE_KEYS.student, { student_id: 7 });
    const authExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, authExpired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: "Invalid authentication token: Signature has expired",
            data: null,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(progressApi.getAll(7)).rejects.toThrow("Your sign-in expired");

    expect(authExpired).toHaveBeenCalledOnce();
    expect(readStorage(STORAGE_KEYS.token, null)).toBeNull();
    expect(readStorage(STORAGE_KEYS.student, null)).toBeNull();
    window.removeEventListener(AUTH_EXPIRED_EVENT, authExpired);
  });
});
