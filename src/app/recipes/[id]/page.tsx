import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArchiveRecipeForm,
  EditRecipeForm,
  RestoreRecipeForm,
} from "@/components/recipe-forms";
import { RecipeBadges } from "@/components/recipe-badges";
import { RecipeSourceLink } from "@/components/recipe-source-link";
import { createRecipeLibrary } from "@/lib/recipe-library";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseRecipeStore } from "@/lib/supabase/recipe-store";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ household?: string }>;
}

export default async function RecipePage({ params, searchParams }: PageProps) {
  if (!hasSupabaseConfig()) redirect("/");

  const [{ id: recipeId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/");

  const { data: memberships, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", auth.user.id)
    .order("joined_at", { ascending: true });
  if (membershipError || !memberships?.length) redirect("/");

  const householdIds = memberships.map((membership) => membership.household_id);
  const householdId = householdIds.includes(query.household ?? "")
    ? query.household!
    : householdIds[0];
  const { data: household, error: householdError } = await client
    .from("households")
    .select("id, name, available_badges")
    .eq("id", householdId)
    .maybeSingle();
  if (householdError || !household) notFound();

  const library = createRecipeLibrary(createSupabaseRecipeStore(client));
  const recipe = await library.findById({ householdId: household.id, recipeId });
  if (!recipe) notFound();

  const libraryUrl = `/?household=${encodeURIComponent(household.id)}`;
  const settingsUrl = `/settings?household=${encodeURIComponent(household.id)}`;

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="wordmark" href={libraryUrl}>
          {household.name}
        </Link>
        <div className="topbar-actions">
          <Link className="member-email" href={settingsUrl}>
            {auth.user.email ?? "Account settings"}
          </Link>
        </div>
      </header>

      <article className="recipe-detail">
        <header className="recipe-detail-heading">
          {recipe.archivedAt && <span className="pill">Archived recipe</span>}
          <h1>{recipe.title}</h1>
          {recipe.sourceUrl && (
            <p className="recipe-detail-source">
              <RecipeSourceLink sourceUrl={recipe.sourceUrl} />
            </p>
          )}
        </header>

        <RecipeBadges
          householdId={household.id}
          recipe={recipe}
          availableBadges={(household.available_badges as string[]) ?? []}
        />

        <div className="recipe-detail-columns">
          <section aria-labelledby="ingredients-title">
            <h2 id="ingredients-title">Ingredients</h2>
            <ul>
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${index}-${ingredient}`}>{ingredient}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="method-title">
            <h2 id="method-title">Method</h2>
            <ol>
              {recipe.method.map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="recipe-detail-actions">
          {recipe.archivedAt ? (
            <RestoreRecipeForm householdId={household.id} recipeId={recipe.id} />
          ) : (
            <ArchiveRecipeForm
              householdId={household.id}
              recipeId={recipe.id}
              recipeTitle={recipe.title}
            />
          )}
          <details className="edit-details">
            <summary>Correct this recipe</summary>
            <EditRecipeForm
              householdId={household.id}
              recipe={recipe}
              availableBadges={(household.available_badges as string[]) ?? []}
            />
          </details>
        </div>
      </article>
    </main>
  );
}
