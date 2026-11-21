import { describe, expect, it, vi } from "vitest";
import { createSafePageFetcher } from "./safe-page-fetcher";

describe("SafePageFetcher", () => {
  it("does not request a host that resolves to a private address", async () => {
    const request = vi.fn();
    const fetchPage = createSafePageFetcher({
      resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
      request,
    });

    await expect(fetchPage("https://example.com/recipe")).rejects.toThrow(
      "public internet address",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("revalidates redirect targets before making another request", async () => {
    const request = vi.fn(async () => ({
      status: 302,
      location: "http://127.0.0.1/admin",
      contentType: "text/html",
      body: "",
    }));
    const fetchPage = createSafePageFetcher({
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      request,
    });

    await expect(fetchPage("https://example.com/recipe")).rejects.toThrow(
      "public internet address",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
