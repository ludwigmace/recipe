import { PDFParse } from "pdf-parse";
import type { AiRecipeExtractor, RecipeExtraction } from "./recipe-extractor";

export const MAX_RECIPE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_SOURCE_TEXT_LENGTH = 20_000;
const noRecipeWarning =
  "No complete recipe was found. Review the file or enter the recipe details manually.";

export type PdfTextParser = (contents: Uint8Array) => Promise<string>;
export type RecipeFileImportStage = "pdf-text" | "recipe-extraction";

export class RecipeFileImportError extends Error {
  constructor(readonly stage: RecipeFileImportStage, options?: ErrorOptions) {
    super(`Recipe file import failed during ${stage}.`, options);
    this.name = "RecipeFileImportError";
  }
}

async function parsePdf(contents: Uint8Array): Promise<string> {
  const parser = new PDFParse({
    data: contents,
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  });
  try {
    return (await parser.getText({ first: 50 })).text;
  } finally {
    // A cleanup failure should not discard text that was already extracted.
    await parser.destroy().catch(() => undefined);
  }
}

function decodeText(contents: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true })
    .decode(contents)
    .replace(/^\uFEFF/, "");
}

export function createRecipeFileExtractor(
  extractWithAi: AiRecipeExtractor,
  readPdf: PdfTextParser = parsePdf,
) {
  return {
    async extract(
      fileName: string,
      mimeType: string,
      contents: Uint8Array,
    ): Promise<RecipeExtraction> {
      if (contents.byteLength > MAX_RECIPE_FILE_SIZE) {
        throw new Error("Choose a file smaller than 5 MB.");
      }

      const extension = fileName.toLowerCase().split(".").pop();
      let sourceText: string;
      if (extension === "txt") {
        if (mimeType && mimeType !== "text/plain") {
          throw new Error("Choose a plain-text (.txt) or PDF file.");
        }
        try {
          sourceText = decodeText(contents);
        } catch {
          throw new Error("This text file is not valid UTF-8.");
        }
      } else if (extension === "pdf") {
        if (mimeType && mimeType !== "application/pdf") {
          throw new Error("Choose a plain-text (.txt) or PDF file.");
        }
        if (
          contents.byteLength < 5 ||
          new TextDecoder().decode(contents.subarray(0, 5)) !== "%PDF-"
        ) {
          throw new Error("This file is not a valid PDF.");
        }
        try {
          sourceText = await readPdf(contents);
        } catch (error) {
          throw new RecipeFileImportError("pdf-text", { cause: error });
        }
      } else {
        throw new Error("Choose a plain-text (.txt) or PDF file.");
      }

      sourceText = sourceText.replace(/\u0000/g, "").trim().slice(0, MAX_SOURCE_TEXT_LENGTH);
      if (!sourceText) {
        return { recipe: null, warning: noRecipeWarning };
      }

      let recipe: Awaited<ReturnType<AiRecipeExtractor>>;
      try {
        recipe = await extractWithAi(sourceText);
      } catch {
        throw new RecipeFileImportError("recipe-extraction");
      }
      if (
        !recipe?.title.trim() ||
        !recipe.ingredients.some((ingredient) => ingredient.trim()) ||
        !recipe.method.some((step) => step.trim())
      ) {
        return { recipe: null, warning: noRecipeWarning };
      }

      return {
        recipe: { ...recipe, sourceUrl: null },
        warning: null,
      };
    },
  };
}
