import { describe, expect, it, vi } from "vitest";
import {
  createLlmPreparationStepGenerator,
  createLlmRecipeExtractor,
} from "./llm-recipe-extractor";

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

  it("generates a structured preparation version from the original recipe", async () => {
    vi.stubEnv("LLM_MODEL", "big-pickle");
    vi.stubEnv("LLM_KEY", "test-key");
    let requestBody = "";
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  steps: [
                    {
                      title: "Prepare the vegetables",
                      ingredients: ["2 carrots"],
                      method: ["Peel and chop the carrots."],
                    },
                    {
                      title: "Cook",
                      ingredients: ["2 carrots", "1 cup broth"],
                      method: ["Add the carrots and broth to a pot.", "Simmer until tender."],
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", request);

    try {
      await expect(
        createLlmPreparationStepGenerator()({
          title: "Carrot soup",
          ingredients: ["2 carrots", "1 cup broth"],
          method: ["Chop the carrots.", "Simmer in broth until tender."],
        }),
      ).resolves.toEqual([
        {
          title: "Prepare the vegetables",
          ingredients: ["2 carrots"],
          method: ["Peel and chop the carrots."],
        },
        {
          title: "Cook",
          ingredients: ["2 carrots", "1 cup broth"],
          method: ["Add the carrots and broth to a pot.", "Simmer until tender."],
        },
      ]);
      expect(requestBody).toContain("Carrot soup");
      expect(requestBody).toContain("Do not invent ingredients");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("rejects generated steps that change or omit original ingredients", async () => {
    vi.stubEnv("LLM_MODEL", "big-pickle");
    vi.stubEnv("LLM_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    steps: [
                      {
                        title: "Cook",
                        ingredients: ["1 tbsp olive oil"],
                        method: ["Heat the oil."],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    try {
      await expect(
        createLlmPreparationStepGenerator()({
          title: "Carrot soup",
          ingredients: ["2 carrots", "1 cup broth"],
          method: ["Simmer."],
        }),
      ).rejects.toThrow("The LLM changed or omitted one or more recipe ingredients");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
