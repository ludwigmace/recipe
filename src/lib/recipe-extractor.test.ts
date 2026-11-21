import { describe, expect, it } from "vitest";
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
});
