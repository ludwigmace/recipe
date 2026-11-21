"use client";

import { useActionState, useState } from "react";
import { updateRecipeBadgesAction } from "@/app/actions";
import type { Recipe } from "@/lib/recipe-library";

export function RecipeBadges({
  householdId,
  recipe,
  availableBadges,
}: {
  householdId: string;
  recipe: Recipe;
  availableBadges: string[];
}) {
  const [state, action, pending] = useActionState(updateRecipeBadgesAction, {});
  const [open, setOpen] = useState(false);
  const badgeOptions = [...new Set([...recipe.badges, ...availableBadges])];

  return (
    <section className="recipe-badges-section" aria-labelledby="recipe-badges-title">
      <div className="recipe-badges-heading">
        <h2 id="recipe-badges-title">Badges</h2>
        <button
          className="badge-add-button"
          type="button"
          aria-label={open ? "Close badge picker" : "Add a badge"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "×" : "+"}
        </button>
      </div>
      {recipe.badges.length > 0 ? (
        <div className="recipe-meta">
          {recipe.badges.map((badge) => <span className="pill" key={badge}>{badge}</span>)}
        </div>
      ) : (
        <p className="field-note">No badges yet.</p>
      )}
      {open && (
        <form className="recipe-badge-form" action={action}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="recipeId" value={recipe.id} />
          {badgeOptions.length > 0 ? (
            <fieldset className="badge-picker">
              <legend>Choose any badges that fit</legend>
              <div className="badge-options">
                {badgeOptions.map((badge) => (
                  <label key={badge}>
                    <input
                      type="checkbox"
                      name="badge"
                      value={badge}
                      defaultChecked={recipe.badges.includes(badge)}
                    />
                    <span>{badge}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="field-note">
              Add available badges in{" "}
              <a href={`/settings?household=${encodeURIComponent(householdId)}`}>Settings</a>.
            </p>
          )}
          <button className="button button-small" type="submit" disabled={pending || badgeOptions.length === 0}>
            {pending ? "Saving…" : "Save badges"}
          </button>
          {state.error && <p className="inline-error" role="alert">{state.error}</p>}
          {state.message && <p className="inline-success" role="status">{state.message}</p>}
        </form>
      )}
    </section>
  );
}
