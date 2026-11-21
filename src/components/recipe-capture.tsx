"use client";

import { useActionState, useState } from "react";
import { saveRecipeAction } from "@/app/actions";
import type { RecipeExtraction } from "@/lib/recipe-extractor";

interface Draft {
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string;
}

export function RecipeCapture({ householdId }: { householdId: string }) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [warning, setWarning] = useState("");
  const [extractError, setExtractError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saveState, saveAction, saving] = useActionState(saveRecipeAction, {});

  async function extractRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExtractError("");
    setWarning("");
    setDraft(null);
    setExtracting(true);
    try {
      const response = await fetch("/api/recipes/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      const result = (await response.json()) as RecipeExtraction;
      if (!response.ok) {
        throw new Error(result.warning ?? "Could not read that recipe page.");
      }

      setDraft(
        result.recipe ?? {
          title: "",
          ingredients: [],
          method: [],
          sourceUrl: url,
        },
      );
      setWarning(result.warning ?? "");
    } catch (error) {
      setDraft({ title: "", ingredients: [], method: [], sourceUrl: url });
      setExtractError(
        error instanceof Error
          ? error.message
          : "Could not read that recipe page. You can enter it manually.",
      );
    } finally {
      setExtracting(false);
    }
  }

  function updateDraft(key: keyof Draft, value: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      [key]: key === "ingredients" || key === "method"
        ? value.split(/\r?\n/)
        : value,
    });
  }

  return (
    <section className="capture-card" aria-labelledby="capture-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAVE SOMETHING GOOD</p>
          <h2 id="capture-title">Bring a recipe home</h2>
          <p>Paste a recipe page. We’ll keep the useful part and leave the ads behind.</p>
        </div>
      </div>

      <form className="capture-form" onSubmit={extractRecipe}>
        <label className="sr-only" htmlFor="recipe-url">Recipe webpage URL</label>
        <input
          id="recipe-url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
        <button className="button" type="submit" disabled={extracting}>
          {extracting ? "Reading page…" : "Find recipe"}
        </button>
      </form>
      <p className="field-note">
        Your saved copy stays as it was when you added it. The original page is
        kept as its source.
      </p>
      {extractError && <p className="warning-note" role="status">{extractError}</p>}

      {draft && (
        <form className="recipe-editor" action={saveAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="sourceUrl" value={draft.sourceUrl} />
          <div>
            <p className="eyebrow">REVIEW BEFORE SAVING</p>
            <h3>Make it yours to cook from.</h3>
          </div>
          {warning && <p className="warning-note">{warning}</p>}
          <label>
            Recipe name
            <input
              name="title"
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              maxLength={200}
            />
          </label>
          <div className="editor-grid">
            <label>
              Ingredients <span className="field-note">One ingredient per line</span>
              <textarea
                name="ingredients"
                value={draft.ingredients.join("\n")}
                onChange={(event) => updateDraft("ingredients", event.target.value)}
              />
            </label>
            <label>
              Method <span className="field-note">One step per line</span>
              <textarea
                name="method"
                value={draft.method.join("\n")}
                onChange={(event) => updateDraft("method", event.target.value)}
              />
            </label>
          </div>
          <p className="source-note">
            Source: <a href={draft.sourceUrl} target="_blank" rel="noreferrer">{draft.sourceUrl}</a>
          </p>
          <div className="editor-actions">
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save to household"}
            </button>
            <button className="text-button" type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
          {saveState.error && <p className="inline-error" role="alert">{saveState.error}</p>}
          {saveState.message && <p className="inline-success" role="status">{saveState.message}</p>}
        </form>
      )}
    </section>
  );
}
