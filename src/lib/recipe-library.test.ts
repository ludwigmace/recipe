import { describe, expect, it } from "vitest";
import {
  createRecipeLibrary,
  type Recipe,
  type RecipeStore,
} from "./recipe-library";

function createMemoryStore(): RecipeStore {
  const recipes = new Map<string, Recipe>();

  return {
    async findBySource(householdId, sourceUrl) {
      return (
        [...recipes.values()].find(
          (recipe) =>
            recipe.householdId === householdId && recipe.sourceUrl === sourceUrl,
        ) ?? null
      );
    },
    async findById(householdId, recipeId) {
      const recipe = recipes.get(recipeId);
      return recipe?.householdId === householdId ? recipe : null;
    },
    async search(householdId, query) {
      return [...recipes.values()].filter(
        (recipe) =>
          recipe.householdId === householdId &&
          recipe.archivedAt === null &&
          recipe.title.toLowerCase().includes(query.toLowerCase()),
      );
    },
    async listArchived(householdId) {
      return [...recipes.values()].filter(
        (recipe) =>
          recipe.householdId === householdId && recipe.archivedAt !== null,
      );
    },
    async insert(recipe) {
      if (
        recipe.sourceUrl !== null &&
        [...recipes.values()].some(
          (existing) =>
            existing.householdId === recipe.householdId &&
            existing.sourceUrl === recipe.sourceUrl,
        )
      ) {
        throw new Error("duplicate source");
      }
      recipes.set(recipe.id, recipe);
      return recipe;
    },
    async update(householdId, recipeId, changes) {
      const current = await this.findById(householdId, recipeId);
      if (!current) return null;
      const updated = { ...current, ...changes };
      recipes.set(recipeId, updated);
      return updated;
    },
  };
}

describe("RecipeLibrary", () => {
  it("saves a manually created recipe without a source URL", async () => {
    const library = createRecipeLibrary(createMemoryStore());

    const { recipe: saved } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Grandma's Soup",
      ingredients: ["2 cups broth"],
      method: ["Simmer"],
      sourceUrl: null,
    });

    expect(saved.sourceUrl).toBeNull();
    expect(saved.badges).toEqual([]);
  });

  it("saves and edits multiple recipe badges", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Tomato Soup",
      ingredients: ["tomatoes"],
      method: ["Simmer"],
      sourceUrl: null,
      badges: ["soup", "dinner"],
    });

    const edited = await library.edit({
      householdId: "home-1",
      recipeId: recipe.id,
      title: "Tomato Soup",
      ingredients: ["tomatoes"],
      method: ["Simmer"],
      badges: ["lunch", "soup", "soup"],
    });

    expect(recipe.badges).toEqual(["soup", "dinner"]);
    expect(edited.badges).toEqual(["lunch", "soup"]);
  });

  it("updates recipe badges without editing recipe content", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Tomato Soup",
      ingredients: ["tomatoes"],
      method: ["Simmer"],
      sourceUrl: null,
    });

    const updated = await library.setBadges({
      householdId: "home-1",
      recipeId: recipe.id,
      badges: ["dinner", "soup"],
    });

    expect(updated).toMatchObject({
      title: recipe.title,
      ingredients: recipe.ingredients,
      method: recipe.method,
      badges: ["dinner", "soup"],
    });
  });

  it("requires an HTTP or HTTPS URL when a source is provided", async () => {
    const library = createRecipeLibrary(createMemoryStore());

    await expect(
      library.save({
        householdId: "home-1",
        actorId: "member-1",
        title: "Grandma's Soup",
        ingredients: ["2 cups broth"],
        method: ["Simmer"],
        sourceUrl: "ftp://example.com/soup",
      }),
    ).rejects.toThrow("Recipe sources must use HTTP or HTTPS");
  });

  it("allows multiple manually created recipes without source URLs", async () => {
    const library = createRecipeLibrary(createMemoryStore());

    const { recipe: first } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Grandma's Soup",
      ingredients: ["2 cups broth"],
      method: ["Simmer"],
      sourceUrl: null,
    });
    const { recipe: second } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sunday Roast",
      ingredients: ["1 roast"],
      method: ["Roast"],
      sourceUrl: null,
    });

    expect(second.id).not.toBe(first.id);
  });

  it("saves a recipe and makes it findable by title", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe: saved } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato", "1 pie crust"],
      method: ["Mix filling", "Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });

    expect(saved.title).toBe("Sweet Potato Pie");
    await expect(
      library.search({ householdId: "home-1", query: "sweet potato" }),
    ).resolves.toContainEqual(saved);
  });

  it("returns the existing recipe when the same source URL is saved again", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const draft = {
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato", "1 pie crust"],
      method: ["Mix filling", "Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    };

    const firstResult = await library.save(draft);
    const secondResult = await library.save({ ...draft, title: "Updated page title" });

    expect(secondResult.recipe.id).toBe(firstResult.recipe.id);
    expect(secondResult.recipe.title).toBe("Sweet Potato Pie");
    expect(firstResult.wasDuplicate).toBe(false);
    expect(secondResult.wasDuplicate).toBe(true);
  });

  it("finds a saved recipe by its canonical source URL within its household", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });

    await expect(
      library.findBySource({
        householdId: "home-1",
        sourceUrl: "https://example.com/sweet-potato-pie#recipe",
      }),
    ).resolves.toEqual(recipe);
    await expect(
      library.findBySource({
        householdId: "home-2",
        sourceUrl: "https://example.com/sweet-potato-pie",
      }),
    ).resolves.toBeNull();
  });

  it("finds a recipe by id only within its household", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });

    await expect(
      library.findById({ householdId: "home-1", recipeId: recipe.id }),
    ).resolves.toEqual(recipe);
    await expect(
      library.findById({ householdId: "home-2", recipeId: recipe.id }),
    ).resolves.toBeNull();
  });

  it("opens an existing recipe even when the duplicate page cannot be extracted", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const draft = {
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    };
    const { recipe: saved } = await library.save(draft);

    const duplicate = await library.save({
      ...draft,
      title: "",
      ingredients: [],
      method: [],
    });

    expect(duplicate.recipe.id).toBe(saved.id);
    expect(duplicate.wasDuplicate).toBe(true);
  });

  it("returns the winning recipe when simultaneous saves race on the same URL", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const draft = {
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    };

    const [first, second] = await Promise.all([
      library.save(draft),
      library.save(draft),
    ]);

    expect(second.recipe.id).toBe(first.recipe.id);
    expect([first.wasDuplicate, second.wasDuplicate]).toContain(true);
  });

  it("hides an archived recipe from normal search", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });

    await library.archive({ householdId: "home-1", recipeId: recipe.id });

    await expect(
      library.search({ householdId: "home-1", query: "sweet potato" }),
    ).resolves.toEqual([]);
  });

  it("lists archived recipes separately so members can restore them", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });
    await library.archive({ householdId: "home-1", recipeId: recipe.id });

    await expect(
      library.listArchived({ householdId: "home-1" }),
    ).resolves.toContainEqual(expect.objectContaining({ id: recipe.id }));
  });

  it("restores an archived recipe to normal search", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });
    await library.archive({ householdId: "home-1", recipeId: recipe.id });

    await library.restore({ householdId: "home-1", recipeId: recipe.id });

    await expect(
      library.search({ householdId: "home-1", query: "sweet potato" }),
    ).resolves.toContainEqual(expect.objectContaining({ id: recipe.id }));
  });

  it("updates the shared recipe content without changing its source", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const { recipe } = await library.save({
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });

    const edited = await library.edit({
      householdId: "home-1",
      recipeId: recipe.id,
      title: "Grandma's Sweet Potato Pie",
      ingredients: ["3 cups mashed sweet potato"],
      method: ["Mix filling", "Bake until set"],
    });

    expect(edited).toMatchObject({
      title: "Grandma's Sweet Potato Pie",
      ingredients: ["3 cups mashed sweet potato"],
      method: ["Mix filling", "Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    });
  });

  it("restores an archived recipe when its source URL is saved again", async () => {
    const library = createRecipeLibrary(createMemoryStore());
    const draft = {
      householdId: "home-1",
      actorId: "member-1",
      title: "Sweet Potato Pie",
      ingredients: ["2 cups mashed sweet potato"],
      method: ["Bake until set"],
      sourceUrl: "https://example.com/sweet-potato-pie",
    };
    const { recipe: saved } = await library.save(draft);
    await library.archive({ householdId: "home-1", recipeId: saved.id });

    const reopened = await library.save({
      ...draft,
      title: "",
      ingredients: [],
      method: [],
    });

    expect(reopened.recipe.id).toBe(saved.id);
    expect(reopened.recipe.archivedAt).toBeNull();
    expect(reopened.wasDuplicate).toBe(true);
  });

  it("requires title, ingredients, and method before saving", async () => {
    const library = createRecipeLibrary(createMemoryStore());

    await expect(
      library.save({
        householdId: "home-1",
        actorId: "member-1",
        title: "Sweet Potato Pie",
        ingredients: ["2 cups mashed sweet potato"],
        method: [],
        sourceUrl: "https://example.com/sweet-potato-pie",
      }),
    ).rejects.toThrow("Add at least one method step");
  });
});
