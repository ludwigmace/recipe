import { NextResponse } from "next/server";
import { createLlmRecipeExtractor } from "@/lib/llm-recipe-extractor";
import {
  createRecipeFileExtractor,
  MAX_RECIPE_FILE_SIZE,
  RecipeFileImportError,
} from "@/lib/recipe-file-extractor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_MULTIPART_SIZE = MAX_RECIPE_FILE_SIZE + 64 * 1024;

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getUser();
  if (!data.user) {
    return NextResponse.json(
      { recipe: null, warning: "Sign in before importing a recipe." },
      { status: 401 },
    );
  }
  const { data: membership } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { recipe: null, warning: "Create or join a household before importing recipes." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_MULTIPART_SIZE) {
    return NextResponse.json(
      { recipe: null, warning: "Choose a file smaller than 5 MB." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { recipe: null, warning: "Choose a plain-text (.txt) or PDF file." },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) {
    return NextResponse.json(
      { recipe: null, warning: "Choose a plain-text (.txt) or PDF file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_RECIPE_FILE_SIZE) {
    return NextResponse.json(
      { recipe: null, warning: "Choose a file smaller than 5 MB." },
      { status: 413 },
    );
  }

  try {
    const extractor = createRecipeFileExtractor(createLlmRecipeExtractor());
    const result = await extractor.extract(
      file.name,
      file.type,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof RecipeFileImportError) {
      if (error.stage === "pdf-text") {
        const cause = error.cause;
        const detail = cause instanceof Error
          ? `${cause.name}: ${cause.message}`.slice(0, 300)
          : "Unknown PDF parser error";
        console.error(`[recipe-file-import] PDF text extraction failed: ${detail}`);
      } else {
        console.error(`[recipe-file-import] ${error.stage} failed`);
      }
      return NextResponse.json(
        {
          recipe: null,
          warning: error.stage === "pdf-text"
            ? "We couldn’t extract text from this PDF. Try exporting it again or importing its text as a .txt file."
            : "We read the file, but recipe extraction failed. Please try again or enter the recipe manually.",
        },
        { status: 422 },
      );
    }
    const isInvalidFile =
      message.startsWith("Choose ") ||
      message.startsWith("This file") ||
      message.startsWith("This text file");
    return NextResponse.json(
      {
        recipe: null,
        warning: isInvalidFile
          ? message
          : "We couldn’t read this file. You can still enter the recipe manually.",
      },
      { status: isInvalidFile ? 400 : 422 },
    );
  }
}
