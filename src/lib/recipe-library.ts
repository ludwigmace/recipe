export interface RecipeDraft {
  householdId: string;
  actorId: string;
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string | null;
  badges?: string[];
}

export interface PreparationStep {
  title: string;
  ingredients: string[];
  method: string[];
}

export interface Recipe extends RecipeDraft {
  badges: string[];
  preparationSteps: PreparationStep[] | null;
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
      Pick<
        Recipe,
        | "title"
        | "ingredients"
        | "method"
        | "badges"
        | "preparationSteps"
        | "archivedAt"
        | "updatedAt"
      >
    >,
  ): Promise<Recipe | null>;
}

export interface RecipeSaveResult {
  recipe: Recipe;
  wasDuplicate: boolean;
}

export interface RecipeLibrary {
  save(draft: RecipeDraft): Promise<RecipeSaveResult>;
  findBySource(input: {
    householdId: string;
    sourceUrl: string;
  }): Promise<Recipe | null>;
  findById(input: { householdId: string; recipeId: string }): Promise<Recipe | null>;
  search(input: { householdId: string; query: string }): Promise<Recipe[]>;
  listArchived(input: { householdId: string }): Promise<Recipe[]>;
  archive(input: { householdId: string; recipeId: string }): Promise<Recipe>;
  restore(input: { householdId: string; recipeId: string }): Promise<Recipe>;
  setBadges(input: {
    householdId: string;
    recipeId: string;
    badges: string[];
  }): Promise<Recipe>;
  edit(input: {
    householdId: string;
    recipeId: string;
    title: string;
    ingredients: string[];
    method: string[];
    badges?: string[];
  }): Promise<Recipe>;
  setPreparationSteps(input: {
    householdId: string;
    recipeId: string;
    preparationSteps: PreparationStep[] | null;
  }): Promise<Recipe>;
}

export class RecipeNotFoundError extends Error {
  constructor() {
    super("Recipe not found");
    this.name = "RecipeNotFoundError";
  }
}

function canonicalizeSourceUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
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

export function normalizePreparationSteps(
  steps: PreparationStep[],
): PreparationStep[] {
  if (!steps.length || steps.length > 50) {
    throw new Error("A step version must contain between 1 and 50 steps");
  }
  const normalized = steps.map((step) => ({
    title: step.title.trim(),
    ingredients: step.ingredients.map((item) => item.trim()).filter(Boolean),
    method: step.method.map((item) => item.trim()).filter(Boolean),
  }));
  if (normalized.some((step) => !step.title || step.title.length > 100)) {
    throw new Error("Each preparation step needs a title of at most 100 characters");
  }
  if (normalized.some((step) => !step.method.length || step.method.some((item) => item.length > 2000))) {
    throw new Error("Each preparation step needs instructions of at most 2,000 characters");
  }
  if (normalized.some((step) => step.ingredients.some((item) => item.length > 500))) {
    throw new Error("Each step ingredient must be 500 characters or fewer");
  }
  const ingredientCount = normalized.reduce(
    (count, step) => count + step.ingredients.length,
    0,
  );
  if (ingredientCount === 0) {
    throw new Error("Add at least one ingredient to the preparation steps");
  }
  if (ingredientCount > 100) {
    throw new Error("A step version can contain at most 100 ingredient entries");
  }
  return normalized;
}

export function createRecipeLibrary(store: RecipeStore): RecipeLibrary {
  function requireRecipe(recipe: Recipe | null): Recipe {
    if (!recipe) throw new RecipeNotFoundError();
    return recipe;
  }

  async function restoreArchivedDuplicate(recipe: Recipe): Promise<RecipeSaveResult> {
    const now = new Date().toISOString();
    return {
      recipe: requireRecipe(
        await store.update(recipe.householdId, recipe.id, {
          archivedAt: null,
          updatedAt: now,
        }),
      ),
      wasDuplicate: true,
    };
  }

  return {
    async save(draft) {
      const sourceUrl = canonicalizeSourceUrl(draft.sourceUrl);
      const existing = sourceUrl
        ? await store.findBySource(draft.householdId, sourceUrl)
        : null;
      if (existing?.archivedAt) return restoreArchivedDuplicate(existing);
      if (existing) return { recipe: existing, wasDuplicate: true };

      requireRecipeContent(draft);
      const now = new Date().toISOString();
      const recipe = {
        ...draft,
        id: crypto.randomUUID(),
        sourceUrl,
        badges: draft.badges ?? [],
        preparationSteps: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        return { recipe: await store.insert(recipe), wasDuplicate: false };
      } catch (error) {
        if (!sourceUrl) throw error;
        const winner = await store.findBySource(draft.householdId, sourceUrl);
        if (!winner) throw error;
        if (winner.archivedAt === null) {
          return { recipe: winner, wasDuplicate: true };
        }
        return restoreArchivedDuplicate(winner);
      }
    },

    async findBySource({ householdId, sourceUrl }) {
      const canonicalUrl = canonicalizeSourceUrl(sourceUrl);
      return canonicalUrl
        ? store.findBySource(householdId, canonicalUrl)
        : null;
    },

    async findById({ householdId, recipeId }) {
      return store.findById(householdId, recipeId);
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

    async setBadges({ householdId, recipeId, badges }) {
      requireRecipe(await store.findById(householdId, recipeId));
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          badges: [...new Set(badges.map((badge) => badge.trim().toLowerCase()))],
          updatedAt: now,
        }),
      );
    },

    async edit({ householdId, recipeId, title, ingredients, method, badges }) {
      requireRecipe(await store.findById(householdId, recipeId));
      requireRecipeContent({ title, ingredients, method });
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          title: title.trim(),
          ingredients: ingredients.map((item) => item.trim()).filter(Boolean),
          method: method.map((step) => step.trim()).filter(Boolean),
          ...(badges !== undefined && {
            badges: [...new Set(badges.map((badge) => badge.trim().toLowerCase()))],
          }),
          updatedAt: now,
        }),
      );
    },

    async setPreparationSteps({ householdId, recipeId, preparationSteps }) {
      requireRecipe(await store.findById(householdId, recipeId));
      const normalizedSteps = preparationSteps
        ? normalizePreparationSteps(preparationSteps)
        : null;
      const now = new Date().toISOString();
      return requireRecipe(
        await store.update(householdId, recipeId, {
          preparationSteps: normalizedSteps,
          updatedAt: now,
        }),
      );
    },
  };
}
