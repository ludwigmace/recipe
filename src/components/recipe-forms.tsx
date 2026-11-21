"use client";

import { useActionState } from "react";
import {
  archiveRecipeAction,
  editRecipeAction,
  restoreRecipeAction,
} from "@/app/actions";
import type { Recipe } from "@/lib/recipe-library";

export function ArchiveRecipeForm({
  householdId,
  recipeId,
  recipeTitle,
}: {
  householdId: string;
  recipeId: string;
  recipeTitle: string;
}) {
  const [state, action, pending] = useActionState(archiveRecipeAction, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Archive “${recipeTitle}”? You can restore it later.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <button className="text-button" type="submit" disabled={pending}>
        {pending ? "Archiving…" : "Archive"}
      </button>
      {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    </form>
  );
}

export function RestoreRecipeForm({
  householdId,
  recipeId,
}: {
  householdId: string;
  recipeId: string;
}) {
  const [state, action, pending] = useActionState(restoreRecipeAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <button className="button button-small button-quiet" type="submit" disabled={pending}>
        {pending ? "Restoring…" : "Restore"}
      </button>
      {state.error && <span className="inline-error" role="alert">{state.error}</span>}
    </form>
  );
}

export function EditRecipeForm({
  householdId,
  recipe,
  availableBadges,
}: {
  householdId: string;
  recipe: Recipe;
  availableBadges: string[];
}) {
  const [state, action, pending] = useActionState(editRecipeAction, {});

  return (
    <form className="edit-form" action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="recipeId" value={recipe.id} />
      <label>
        Recipe name
        <input name="title" defaultValue={recipe.title} maxLength={200} required />
      </label>
      <div className="editor-grid">
        <label>
          Ingredients
          <textarea name="ingredients" defaultValue={recipe.ingredients.join("\n")} required />
        </label>
        <label>
          Method
          <textarea name="method" defaultValue={recipe.method.join("\n")} required />
        </label>
      </div>
      <fieldset className="badge-picker">
        <legend>Badges <span className="field-note">Optional; choose any that fit</span></legend>
        <div className="badge-options">
          {availableBadges.map((badge) => (
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
      <button className="button button-small" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save correction"}
      </button>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.message && <p className="inline-success" role="status">{state.message}</p>}
    </form>
  );
}
