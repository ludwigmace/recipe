export interface RecipeDraft {
  householdId: string;
  actorId: string;
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string;
}

export interface Recipe extends RecipeDraft {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeStore {
  findBySource(householdId: string, sourceUrl: string): Promise<Recipe | null>;
  findById(householdId: string, recipeId: string): Promise<Recipe | null>;
  search(householdId: string, query: string): Promise<Recipe[]>;
  listArchived(householdId: string): Promise<Recipe[]>;
  insert(recipe: Recipe): Promise<Recipe>;
  update(
    householdId: string,
    recipeId: string,
    changes: Partial<
      Pick<Recipe, "title" | "ingredients" | "method" | "archivedAt" | "updatedAt">
    >,
  ): Promise<Recipe | null>;
}

export interface RecipeLibrary {
  save(draft: RecipeDraft): Promise<Recipe>;
  search(input: { householdId: string; query: string }): Promise<Recipe[]>;
  listArchived(input: { householdId: string }): Promise<Recipe[]>;
  archive(input: { householdId: string; recipeId: string }): Promise<Recipe>;
  restore(input: { householdId: string; recipeId: string }): Promise<Recipe>;
  edit(input: {
    householdId: string;
    recipeId: string;
    title: string;
    ingredients: string[];
    method: string[];
  }): Promise<Recipe>;
}

export class RecipeNotFoundError extends Error {
  constructor() {
    super("Recipe not found");
    this.name = "RecipeNotFoundError";
  }
}

function canonicalizeSourceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Recipe sources must use HTTP or HTTPS");
  }
  url.hash = "";
  return url.toString();
}

function requireRecipeContent(input: {
  title: string;
  ingredients: string[];
  method: string[];
}) {
  if (!input.title.trim()) throw new Error("A recipe title is required");
  if (!input.ingredients.some((item) => item.trim())) {
    throw new Error("Add at least one ingredient");
  }
  if (!input.method.some((step) => step.trim())) {
    throw new Error("Add at least one method step");
  }
}

export function createRecipeLibrary(store: RecipeStore): RecipeLibrary {
  function requireRecipe(recipe: Recipe | null): Recipe {
    if (!recipe) throw new RecipeNotFoundError();
    return recipe;
  }

  return {
    async save(draft) {
      const sourceUrl = canonicalizeSourceUrl(draft.sourceUrl);
      const existing = await store.findBySource(draft.householdId, sourceUrl);
      if (existing?.archivedAt) {
        const now = new Date().toISOString();
        return requireRecipe(
          await store.update(draft.householdId, existing.id, {
            archivedAt: null,
            updatedAt: now,
          }),
        );
      }
      if (existing) return existing;

      requireRecipeContent(draft);
      const now = new Date().toISOString();
      const recipe = {
        ...draft,
        id: crypto.randomUUID(),
        sourceUrl,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        return await store.insert(recipe);
      } catch (error) {
        const winner = await store.findBySource(draft.householdId, sourceUrl);
        if (!winner) throw error;
        if (winner.archivedAt === null) return winner;
        const restoredAt = new Date().toISOString();
        return requireRecipe(
          await store.update(draft.householdId, winner.id, {
            archivedAt: null,
            updatedAt: restoredAt,
          }),
        );
      }
    },

    async search({ householdId, query }) {
      return store.search(householdId, query.trim());
    },

    async listArchived({ householdId }) {
      return store.listArchived(householdId);
    },

    async archive({ householdId, recipeId }) {
      requireRecipe(await store.findById(householdId, recipeId));
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          archivedAt: now,
          updatedAt: now,
        }),
      );
    },

    async restore({ householdId, recipeId }) {
      requireRecipe(await store.findById(householdId, recipeId));
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          archivedAt: null,
          updatedAt: now,
        }),
      );
    },

    async edit({ householdId, recipeId, title, ingredients, method }) {
      requireRecipe(await store.findById(householdId, recipeId));
      requireRecipeContent({ title, ingredients, method });
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          title: title.trim(),
          ingredients: ingredients.map((item) => item.trim()).filter(Boolean),
          method: method.map((step) => step.trim()).filter(Boolean),
          updatedAt: now,
        }),
      );
    },
  };
}
