import { describe, expect, it, vi } from "vitest";
import { createRecipeExtractor } from "./recipe-extractor";

describe("RecipeExtractor", () => {
  it("extracts a recipe from Schema.org JSON-LD on an ad-heavy page", async () => {
    const html = `<!doctype html>
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Sweet Potato Pie",
            "recipeIngredient": ["2 cups mashed sweet potato", "1 pie crust"],
            "recipeInstructions": [
              {"@type": "HowToStep", "text": "Mix the filling."},
              {"@type": "HowToStep", "text": "Bake until set."}
            ]
          }
        </script>
      </head><body><div class="advertisement">Ad</div></body></html>`;
    const extractor = createRecipeExtractor(async () => html);

    await expect(
      extractor.extract("https://example.com/sweet-potato-pie"),
    ).resolves.toEqual({
      recipe: {
        title: "Sweet Potato Pie",
        ingredients: ["2 cups mashed sweet potato", "1 pie crust"],
        method: ["Mix the filling.", "Bake until set."],
        sourceUrl: "https://example.com/sweet-potato-pie",
      },
      warning: null,
    });
  });

  it("returns a manual-completion result when no recipe data is present", async () => {
    const extractor = createRecipeExtractor(async () => "<html><body>No recipe data</body></html>");

    await expect(
      extractor.extract("https://example.com/not-a-recipe"),
    ).resolves.toEqual({
      recipe: null,
      warning: "No structured recipe was found. Enter the recipe details manually.",
    });
  });

  it("uses AI on cleaned page text when structured recipe data is missing", async () => {
    const extractWithAi = vi.fn(async (pageText: string) => {
      expect(pageText).toContain("Weeknight tomato pasta");
      expect(pageText).toContain("Boil the pasta.");
      expect(pageText).not.toContain("Buy our cookware");
      expect(pageText).not.toContain("tracking script");
      return {
        title: "Weeknight tomato pasta",
        ingredients: ["200 g pasta", "1 can tomatoes"],
        method: ["Boil the pasta.", "Simmer the tomatoes and combine."],
      };
    });
    const extractor = createRecipeExtractor(
      async () => `<!doctype html><html><body>
        <nav>Buy our cookware</nav>
        <article>
          <h1>Weeknight tomato pasta</h1>
          <p>200 g pasta</p>
          <p>1 can tomatoes</p>
          <p>Boil the pasta.</p>
        </article>
        <script>tracking script</script>
      </body></html>`,
      extractWithAi,
    );

    await expect(
      extractor.extract("https://example.com/tomato-pasta"),
    ).resolves.toEqual({
      recipe: {
        title: "Weeknight tomato pasta",
        ingredients: ["200 g pasta", "1 can tomatoes"],
        method: ["Boil the pasta.", "Simmer the tomatoes and combine."],
        sourceUrl: "https://example.com/tomato-pasta",
      },
      warning: null,
    });
    expect(extractWithAi).toHaveBeenCalledOnce();
  });

  it("does not call AI when structured recipe data is already complete", async () => {
    const extractWithAi = vi.fn();
    const extractor = createRecipeExtractor(
      async () => `<script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Quick soup",
          "recipeIngredient": ["1 cup broth"],
          "recipeInstructions": ["Heat the broth."]
        }
      </script>`,
      extractWithAi,
    );

    await extractor.extract("https://example.com/quick-soup");

    expect(extractWithAi).not.toHaveBeenCalled();
  });
});
