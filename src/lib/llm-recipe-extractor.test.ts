import { describe, expect, it, vi } from "vitest";
import { createLlmRecipeExtractor } from "./llm-recipe-extractor";

describe("LlmRecipeExtractor", () => {
  it("sends cleaned page text to the configured model and parses the recipe", async () => {
    vi.stubEnv("LLM_MODEL", "big-pickle");
    vi.stubEnv("LLM_KEY", "test-key");
    let requestEndpoint = "";
    let requestInit: RequestInit | undefined;
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requestEndpoint = String(input);
        requestInit = init;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "Tomato pasta",
                    ingredients: ["200 g pasta", "1 can tomatoes"],
                    method: ["Boil pasta.", "Simmer tomatoes and combine."],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        );
      },
    );
    vi.stubGlobal("fetch", request);

    try {
      await expect(
        createLlmRecipeExtractor()("Tomato pasta\n200 g pasta\nBoil pasta."),
      ).resolves.toEqual({
        title: "Tomato pasta",
        ingredients: ["200 g pasta", "1 can tomatoes"],
        method: ["Boil pasta.", "Simmer tomatoes and combine."],
      });

      expect(request).toHaveBeenCalledOnce();
      expect(requestEndpoint).toBe(
        "https://opencode.ai/inference/openai/v1/chat/completions",
      );
      expect(new Headers(requestInit?.headers).get("authorization")).toBe(
        "Bearer test-key",
      );
      expect(
        new Headers(requestInit?.headers).get("x-opencode-session"),
      ).toBeTruthy();
      expect(requestInit?.body).toContain("Tomato pasta");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
