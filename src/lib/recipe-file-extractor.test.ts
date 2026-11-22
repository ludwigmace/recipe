import { describe, expect, it, vi } from "vitest";
import {
  createRecipeFileExtractor,
  MAX_RECIPE_FILE_SIZE,
} from "./recipe-file-extractor";

const completeRecipe = {
  title: "Tomato soup",
  ingredients: ["4 tomatoes"],
  method: ["Simmer until soft."],
};

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function textPdf(): Uint8Array {
  const stream = "BT /F1 12 Tf 72 720 Td (OCR text: Tomato soup.) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}

describe("RecipeFileExtractor", () => {
  it("extracts a recipe from plain text without assigning a source URL", async () => {
    const extractWithAi = vi.fn(async (text: string) => {
      expect(text).toContain("Tomato soup");
      return completeRecipe;
    });
    const extractor = createRecipeFileExtractor(extractWithAi);

    await expect(
      extractor.extract("recipe.txt", "text/plain", bytes("Tomato soup\n4 tomatoes")),
    ).resolves.toEqual({
      recipe: { ...completeRecipe, sourceUrl: null },
      warning: null,
    });
    expect(extractWithAi).toHaveBeenCalledOnce();
  });

  it("extracts text from a PDF before sending it to the recipe extractor", async () => {
    const extractWithAi = vi.fn(async () => completeRecipe);
    const readPdf = vi.fn(async () => "PDF recipe text");
    const extractor = createRecipeFileExtractor(extractWithAi, readPdf);

    await expect(
      extractor.extract("recipe.pdf", "application/pdf", bytes("%PDF-1.7")),
    ).resolves.toMatchObject({ recipe: { title: "Tomato soup" }, warning: null });
    expect(readPdf).toHaveBeenCalledOnce();
    expect(extractWithAi).toHaveBeenCalledWith("PDF recipe text");
  });

  it("reads OCR text embedded in a real PDF before extracting the recipe", async () => {
    const extractWithAi = vi.fn(async (text: string) => {
      expect(text).toContain("OCR text: Tomato soup.");
      return completeRecipe;
    });
    const extractor = createRecipeFileExtractor(extractWithAi);

    await expect(
      extractor.extract("ocr-recipe.pdf", "application/pdf", textPdf()),
    ).resolves.toMatchObject({ recipe: { title: "Tomato soup" }, warning: null });
    expect(extractWithAi).toHaveBeenCalledOnce();
  });

  it("rejects unsupported files, malformed PDFs, and oversized files", async () => {
    const extractor = createRecipeFileExtractor(async () => completeRecipe);

    await expect(extractor.extract("recipe.docx", "", bytes("text")))
      .rejects.toThrow("Choose a plain-text (.txt) or PDF file.");
    await expect(extractor.extract("recipe.pdf", "application/pdf", bytes("not a pdf")))
      .rejects.toThrow("This file is not a valid PDF.");
    await expect(
      extractor.extract("recipe.txt", "text/plain", new Uint8Array(MAX_RECIPE_FILE_SIZE + 1)),
    ).rejects.toThrow("Choose a file smaller than 5 MB.");
  });

  it("returns a manual-completion result if the file has no complete recipe", async () => {
    const extractor = createRecipeFileExtractor(async () => null);

    await expect(
      extractor.extract("notes.txt", "text/plain", bytes("A few cooking notes")),
    ).resolves.toEqual({
      recipe: null,
      warning: "No complete recipe was found. Review the file or enter the recipe details manually.",
    });
  });

  it("identifies PDF text-reading failures separately from recipe extraction failures", async () => {
    const pdfExtractor = createRecipeFileExtractor(
      async () => completeRecipe,
      async () => {
        throw new Error("PDF parser failed");
      },
    );
    const recipeExtractor = createRecipeFileExtractor(async () => {
      throw new Error("LLM request failed");
    });

    await expect(pdfExtractor.extract("recipe.pdf", "application/pdf", bytes("%PDF-1.7")))
      .rejects.toMatchObject({ name: "RecipeFileImportError", stage: "pdf-text" });
    await expect(recipeExtractor.extract("recipe.txt", "text/plain", bytes("recipe text")))
      .rejects.toMatchObject({ name: "RecipeFileImportError", stage: "recipe-extraction" });
  });
});
