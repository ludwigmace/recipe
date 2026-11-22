import { load } from "cheerio";

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string | null;
}

export type RecipeExtraction = {
  recipe: ExtractedRecipe | null;
  warning: string | null;
};

export interface RecipeExtractor {
  extract(sourceUrl: string): Promise<RecipeExtraction>;
}

export type PageFetcher = (url: string) => Promise<string>;
export type AiRecipeExtractor = (
  pageText: string,
) => Promise<Omit<ExtractedRecipe, "sourceUrl"> | null>;

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

function pageTextWithoutClutter(html: string): string {
  const $ = load(html);
  $(
    "script, style, noscript, svg, iframe, nav, header, footer, aside, form, " +
      '[data-ad], [class~="ad"], [id^="ad-"], [class*="advert" i], ' +
      '[id*="advert" i], [class*="sponsor" i], [class*="promo" i], ' +
      '[class*="newsletter" i], [class*="cookie" i], [class*="social" i], ' +
      '[class*="share" i], [class*="comment" i], [class*="related" i]',
  ).remove();

  const article = $("article").first();
  const main = $("main").first();
  const content = article.length ? article : main.length ? main : $("body");
  const lines = content
    .find("h1, h2, h3, p, li")
    .toArray()
    .map((element) => text($(element).text()))
    .filter((line): line is string => line !== null);
  const extracted = lines.length ? lines.join("\n") : text(content.text()) ?? "";
  return extracted.slice(0, 20_000);
}

function isComplete(recipe: Omit<ExtractedRecipe, "sourceUrl">): boolean {
  return Boolean(
    recipe.title.trim() &&
      recipe.ingredients.some((ingredient) => ingredient.trim()) &&
      recipe.method.some((step) => step.trim()),
  );
}

export function createRecipeExtractor(
  fetchPage: PageFetcher,
  extractWithAi?: AiRecipeExtractor,
): RecipeExtractor {
  return {
    async extract(sourceUrl) {
      const html = await fetchPage(sourceUrl);
      const structuredRecipe = findRecipe(html, sourceUrl);
      if (
        structuredRecipe &&
        isComplete({
          title: structuredRecipe.title,
          ingredients: structuredRecipe.ingredients,
          method: structuredRecipe.method,
        })
      ) {
        return { recipe: structuredRecipe, warning: null };
      }

      if (extractWithAi) {
        const aiRecipe = await extractWithAi(pageTextWithoutClutter(html));
        if (aiRecipe && isComplete(aiRecipe)) {
          return {
            recipe: { ...aiRecipe, sourceUrl },
            warning: null,
          };
        }
      }

      return structuredRecipe
        ? { recipe: structuredRecipe, warning: noRecipeWarning }
        : { recipe: null, warning: noRecipeWarning };
    },
  };
}
