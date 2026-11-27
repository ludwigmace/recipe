import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/lib/recipe-library";
import { RecipeCollection } from "./recipe-collection";

function createRecipes(): Recipe[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `recipe-${index + 1}`,
    householdId: "household-1",
    actorId: "member-1",
    title: `Recipe ${index + 1}`,
    ingredients: ["ingredient"],
    method: ["cook"],
    sourceUrl: null,
    badges: [],
    preparationSteps: null,
    archivedAt: null,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
}

function renderCollection(showAll = false) {
  return renderToStaticMarkup(
    createElement(RecipeCollection, {
      householdId: "household-1",
      availableBadges: [],
      recipes: createRecipes(),
      archivedRecipes: [],
      query: "",
      showAll,
    }),
  );
}

describe("RecipeCollection", () => {
  it("shows the six newest recipes and links to the full collection", () => {
    const markup = renderCollection();

    expect(markup.match(/class="recipe-card recipe-summary"/g)).toHaveLength(6);
    expect(markup).toContain("Recipe 8");
    expect(markup).toContain("Recipe 3");
    expect(markup).not.toContain("Recipe 2");
    expect(markup.indexOf("Recipe 8")).toBeLessThan(markup.indexOf("Recipe 7"));
    expect(markup).toContain("View all 8 recipes");
    expect(markup).toContain("/?household=household-1&amp;all=1");
  });

  it("shows every recipe in the full collection and links back to the recent view", () => {
    const markup = renderCollection(true);

    expect(markup.match(/class="recipe-card recipe-summary"/g)).toHaveLength(8);
    expect(markup).toContain("Recipe 8");
    expect(markup).toContain("Show fewer recipes");
    expect(markup).toContain("/?household=household-1");
  });
});
