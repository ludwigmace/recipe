import Link from "next/link";
import type { Recipe } from "@/lib/recipe-library";
import { RestoreRecipeForm } from "./recipe-forms";

interface Props {
  householdId: string;
  recipes: Recipe[];
  archivedRecipes: Recipe[];
  query: string;
}

export function RecipeCollection({
  householdId,
  recipes,
  archivedRecipes,
  query,
}: Props) {
  return (
    <section aria-labelledby="collection-title">
      <div className="collection-header">
        <div>
          <h2 id="collection-title">Recipes</h2>
          <span className="collection-count">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
            {query ? ` matching “${query}”` : ""}
          </span>
        </div>
      </div>

      {recipes.length ? (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <Link
              className="recipe-card recipe-summary"
              href={`/recipes/${encodeURIComponent(recipe.id)}?household=${encodeURIComponent(householdId)}`}
              id={`recipe-${recipe.id}`}
              key={recipe.id}
            >
              <div className="recipe-card-content">
                <div className="recipe-meta"><span className="pill">Household recipe</span></div>
                <h3>{recipe.title}</h3>
                {recipe.sourceUrl && (
                  <p
                    className="recipe-source recipe-summary-source"
                    title={recipe.sourceUrl}
                  >
                    Source URL: {recipe.sourceUrl}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{query ? "No matching recipes." : "No recipes yet."}</strong>
          {query
            ? "Try a shorter name, or add a recipe."
            : "Import a recipe from a webpage or create one from scratch."}
        </div>
      )}

      {archivedRecipes.length > 0 && (
        <section className="archived-section" aria-labelledby="archived-title">
          <h2 id="archived-title">Archived recipes</h2>
          <div className="archived-list">
            {archivedRecipes.map((recipe) => (
              <div className="archived-row" id={`recipe-${recipe.id}`} key={recipe.id}>
                <div>
                  <strong>{recipe.title}</strong>
                  {recipe.sourceUrl && (
                    <p>Saved from {new URL(recipe.sourceUrl).hostname}</p>
                  )}
                </div>
                <RestoreRecipeForm householdId={householdId} recipeId={recipe.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
