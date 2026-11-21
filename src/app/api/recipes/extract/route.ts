import { NextResponse } from "next/server";
import { z } from "zod";
import { createLlmRecipeExtractor } from "@/lib/llm-recipe-extractor";
import { createRecipeExtractor } from "@/lib/recipe-extractor";
import { createSafePageFetcher } from "@/lib/safe-page-fetcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  sourceUrl: z.string().url().max(2048),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { recipe: null, warning: "Send a recipe webpage URL to import." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { recipe: null, warning: "Enter a valid recipe webpage URL." },
      { status: 400 },
    );
  }

  try {
    const extractor = createRecipeExtractor(
      createSafePageFetcher(),
      createLlmRecipeExtractor(),
    );
    const result = await extractor.extract(parsed.data.sourceUrl);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        recipe: null,
        warning: "We couldn’t read that page. You can still enter the recipe manually.",
      },
      { status: 422 },
    );
  }
}
