import { load } from "cheerio";

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string;
}

export type RecipeExtraction = {
  recipe: ExtractedRecipe | null;
  warning: string | null;
};

export interface RecipeExtractor {
  extract(sourceUrl: string): Promise<RecipeExtraction>;
}

export type PageFetcher = (url: string) => Promise<string>;

const noRecipeWarning =
  "No structured recipe was found. Enter the recipe details manually.";

function objectsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(objectsFrom);
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const graph = record["@graph"];
  return [record, ...objectsFrom(graph)];
}

function hasRecipeType(value: unknown): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some(
    (item) =>
      typeof item === "string" &&
      (item === "Recipe" || item.endsWith("/Recipe") || item.endsWith("#Recipe")),
  );
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function strings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const normalized = text(item);
    return normalized ? [normalized] : [];
  });
}

function instructionSteps(value: unknown): string[] {
  if (typeof value === "string") return strings(value);
  if (Array.isArray(value)) return value.flatMap(instructionSteps);
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const step = text(record.text) ?? text(record.name);
  if (step && !record.itemListElement) return [step];
  return instructionSteps(record.itemListElement);
}

function findRecipe(html: string, sourceUrl: string): ExtractedRecipe | null {
  const $ = load(html);
  const candidates = $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      const content = $(script).text();
      try {
        return objectsFrom(JSON.parse(content));
      } catch {
        return [];
      }
    });

  for (const candidate of candidates) {
    if (!hasRecipeType(candidate["@type"])) continue;

    const title = text(candidate.name);
    if (!title) continue;

    return {
      title,
      ingredients: strings(candidate.recipeIngredient),
      method: instructionSteps(candidate.recipeInstructions),
      sourceUrl,
    };
  }

  return null;
}

export function createRecipeExtractor(fetchPage: PageFetcher): RecipeExtractor {
  return {
    async extract(sourceUrl) {
      const recipe = findRecipe(await fetchPage(sourceUrl), sourceUrl);
      return recipe
        ? { recipe, warning: null }
        : { recipe: null, warning: noRecipeWarning };
    },
  };
}
