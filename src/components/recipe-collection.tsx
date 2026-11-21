"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Recipe } from "@/lib/recipe-library";
import { RecipeSourceLink } from "./recipe-source-link";
import { RestoreRecipeForm } from "./recipe-forms";

interface Props {
  householdId: string;
  availableBadges: string[];
  recipes: Recipe[];
  archivedRecipes: Recipe[];
  query: string;
}

export function RecipeCollection({
  householdId,
  availableBadges,
  recipes,
  archivedRecipes,
  query,
}: Props) {
  const [search, setSearch] = useState(query);
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const badgeOptions = useMemo(() => [...new Set(availableBadges)].sort(), [availableBadges]);
  const visibleRecipes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return recipes.filter((recipe) => {
      const matchesSearch = !normalizedSearch ||
        recipe.title.toLocaleLowerCase().includes(normalizedSearch);
      const matchesBadges = [...selectedBadges].every((badge) =>
        recipe.badges.includes(badge),
      );
      return matchesSearch && matchesBadges;
    });
  }, [recipes, search, selectedBadges]);
  const hasFilters = Boolean(search.trim()) || selectedBadges.size > 0;

  return (
    <>
      <div className="library-toolbar">
        <div className="library-search">
          <form className="search-form" action="/" method="get" role="search">
            <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
            <input
              id="recipe-search"
              name="q"
              type="search"
              placeholder="Search recipes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <input type="hidden" name="household" value={householdId} />
            <button className="sr-only" type="submit" tabIndex={-1}>Apply search</button>
          </form>
          {badgeOptions.length > 0 && (
            <div className="quick-filters" aria-label="Filter recipes by badge">
              <button
                className={`quick-filter${selectedBadges.size === 0 ? " is-selected" : ""}`}
                type="button"
                aria-pressed={selectedBadges.size === 0}
                onClick={() => setSelectedBadges(new Set())}
              >
                All
              </button>
              {badgeOptions.map((badge) => (
                <button
                  className={`quick-filter${selectedBadges.has(badge) ? " is-selected" : ""}`}
                  type="button"
                  aria-pressed={selectedBadges.has(badge)}
                  key={badge}
                  onClick={() => {
                    setSelectedBadges((current) => {
                      const next = new Set(current);
                      if (next.has(badge)) next.delete(badge);
                      else next.add(badge);
                      return next;
                    });
                  }}
                >
                  {badge}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby="collection-title">
        <div className="collection-header">
          <div>
            <h2 id="collection-title">Recipes</h2>
            <span className="collection-count">
              {visibleRecipes.length} {visibleRecipes.length === 1 ? "recipe" : "recipes"}
              {search.trim() ? ` matching “${search.trim()}”` : ""}
              {selectedBadges.size > 0
                ? ` · ${[...selectedBadges].join(", ")}`
                : ""}
            </span>
          </div>
        </div>

        {visibleRecipes.length ? (
          <div className="recipe-grid">
            {visibleRecipes.map((recipe) => (
              <div
                className="recipe-card recipe-summary"
                id={`recipe-${recipe.id}`}
                key={recipe.id}
              >
                <Link
                  className="recipe-card-main-link"
                  href={`/recipes/${encodeURIComponent(recipe.id)}?household=${encodeURIComponent(householdId)}`}
                >
                  <div className="recipe-card-content">
                    <h3>{recipe.title}</h3>
                    {recipe.badges.length > 0 && (
                      <div className="recipe-meta">
                        {recipe.badges.map((badge) => <span className="pill" key={badge}>{badge}</span>)}
                      </div>
                    )}
                  </div>
                </Link>
                {recipe.sourceUrl && (
                  <RecipeSourceLink
                    className="recipe-source-link recipe-summary-source"
                    sourceUrl={recipe.sourceUrl}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>{hasFilters ? "No matching recipes." : "No recipes yet."}</strong>
            {hasFilters
              ? "Try changing your search or badge filters."
              : "Import a recipe from a webpage or create one from scratch."}
          </div>
        )}
      </section>

      {archivedRecipes.length > 0 && (
        <section className="archived-section" aria-labelledby="archived-title">
          <h2 id="archived-title">Archived recipes</h2>
          <div className="archived-list">
            {archivedRecipes.map((recipe) => (
              <div className="archived-row" id={`recipe-${recipe.id}`} key={recipe.id}>
                <div>
                  {recipe.badges.length > 0 && (
                    <div className="recipe-meta">
                      {recipe.badges.map((badge) => <span className="pill" key={badge}>{badge}</span>)}
                    </div>
                  )}
                  <strong>{recipe.title}</strong>
                  {recipe.sourceUrl && (
                    <p>
                      Saved from{" "}
                      <RecipeSourceLink
                        className="recipe-source-link"
                        sourceUrl={recipe.sourceUrl}
                      />
                    </p>
                  )}
                </div>
                <RestoreRecipeForm householdId={householdId} recipeId={recipe.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
