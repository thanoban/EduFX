import { afterEach, describe, expect, it, vi } from "vitest";

import { progressApi } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { writeStorage } from "@/lib/storage";

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
});
