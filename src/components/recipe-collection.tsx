import type { Recipe } from "@/lib/recipe-library";
import { ArchiveRecipeForm, EditRecipeForm, RestoreRecipeForm } from "./recipe-forms";

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
          <p className="eyebrow">THE COLLECTION</p>
          <h2 id="collection-title">Recipes worth keeping</h2>
          <span className="collection-count">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
            {query ? ` matching “${query}”` : ""}
          </span>
        </div>
        <form className="search-form" action="/" method="get" role="search">
          <label className="sr-only" htmlFor="recipe-search">Search by recipe name</label>
          <input
            id="recipe-search"
            name="q"
            type="search"
            placeholder="Find a recipe by name…"
            defaultValue={query}
          />
          <button className="button button-small" type="submit">Search</button>
        </form>
      </div>

      {recipes.length ? (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <article className="recipe-card" id={`recipe-${recipe.id}`} key={recipe.id}>
              <div className="recipe-card-content">
                <div className="recipe-meta"><span className="pill">Household recipe</span></div>
                <h3>{recipe.title}</h3>
                <p className="recipe-source">
                  From{" "}
                  <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                    {new URL(recipe.sourceUrl).hostname}
                  </a>
                </p>
                <div className="recipe-columns">
                  <div>
                    <h4>Ingredients</h4>
                    <ul>{recipe.ingredients.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <h4>Method</h4>
                    <ol>{recipe.method.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
                  </div>
                </div>
                <div className="recipe-actions">
                  <ArchiveRecipeForm
                    householdId={householdId}
                    recipeId={recipe.id}
                    recipeTitle={recipe.title}
                  />
                  <details className="edit-details">
                    <summary>Correct this recipe</summary>
                    <EditRecipeForm householdId={householdId} recipe={recipe} />
                  </details>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{query ? "No recipe by that name yet." : "Your collection starts here."}</strong>
          {query
            ? "Try a shorter name, or save the recipe above."
            : "Save a recipe from a page full of ads. This is the good part."}
        </div>
      )}

      {archivedRecipes.length > 0 && (
        <section className="archived-section" aria-labelledby="archived-title">
          <p className="eyebrow">TUCKED AWAY, NOT LOST</p>
          <h2 id="archived-title">Archived recipes</h2>
          <div className="archived-list">
            {archivedRecipes.map((recipe) => (
              <div className="archived-row" key={recipe.id}>
                <div>
                  <strong>{recipe.title}</strong>
                  <p>Saved from {new URL(recipe.sourceUrl).hostname}</p>
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
