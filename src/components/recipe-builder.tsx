"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveRecipeAction } from "@/app/actions";
import type { ActionState } from "@/lib/action-state";
import type { RecipeExtraction } from "@/lib/recipe-extractor";

interface Draft {
  title: string;
  ingredients: string[];
  method: string[];
  sourceUrl: string | null;
}

type EntryPath = "import" | "manual";

export function RecipeBuilder({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const libraryUrl = `/?household=${encodeURIComponent(householdId)}`;
  const [entryPath, setEntryPath] = useState<EntryPath | null>(null);
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [warning, setWarning] = useState("");
  const [extractError, setExtractError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const dirtyRef = useRef(false);
  const suppressPopStateRef = useRef(false);

  function markDirty() {
    dirtyRef.current = true;
  }

  function confirmLeave(): boolean {
    if (dirtyRef.current && !window.confirm("Leave without saving your recipe?")) {
      return false;
    }
    dirtyRef.current = false;
    return true;
  }

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmBrowserBack() {
      if (suppressPopStateRef.current) {
        suppressPopStateRef.current = false;
        return;
      }
      if (!dirtyRef.current) return;
      if (window.confirm("Leave without saving your recipe?")) {
        dirtyRef.current = false;
        return;
      }
      suppressPopStateRef.current = true;
      window.history.forward();
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", confirmBrowserBack);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", confirmBrowserBack);
    };
  }, []);

  function cancelEntry() {
    if (!confirmLeave()) return;
    setEntryPath(null);
    setDraft(null);
    setUrl("");
    setWarning("");
    setExtractError("");
  }

  function startManualEntry() {
    setEntryPath("manual");
    setDraft({ title: "", ingredients: [], method: [], sourceUrl: null });
  }

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
      markDirty();
    } catch (error) {
      setDraft({ title: "", ingredients: [], method: [], sourceUrl: url });
      setExtractError(
        error instanceof Error
          ? error.message
          : "Could not read that recipe page. You can enter it manually.",
      );
      markDirty();
    } finally {
      setExtracting(false);
    }
  }

  function updateDraft(key: keyof Draft, value: string) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: key === "ingredients" || key === "method"
          ? value.split(/\r?\n/)
          : value,
      };
    });
    markDirty();
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link
          className="wordmark"
          href={libraryUrl}
          onClick={(event) => {
            if (!confirmLeave()) event.preventDefault();
          }}
        >
          <span className="wordmark-mark" aria-hidden="true">R</span>
          recipe
        </Link>
        <span className="member-email">{householdName}</span>
      </header>

      <section className="recipe-builder">
        <p className="eyebrow">THE HOUSEHOLD COOKBOOK</p>
        <h1>Add a recipe</h1>
        <p className="hero-copy">Add it to {householdName}’s shared collection.</p>

        {entryPath === null ? (
          <div className="recipe-paths" aria-label="Choose how to add a recipe">
            <button
              className="recipe-path"
              type="button"
              onClick={() => setEntryPath("import")}
            >
              <strong>Import from a webpage</strong>
              <span>Paste a recipe link and review what we find.</span>
            </button>
            <button className="recipe-path" type="button" onClick={startManualEntry}>
              <strong>Create manually</strong>
              <span>Enter a recipe you already know and love.</span>
            </button>
          </div>
        ) : (
          <>
            <button className="text-button back-to-paths" type="button" onClick={cancelEntry}>
              ← All ways to add
            </button>

            {entryPath === "import" && (
              <section className="capture-card" aria-labelledby="import-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">IMPORT A RECIPE</p>
                    <h2 id="import-title">Bring a recipe home</h2>
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
                    onChange={(event) => {
                      setUrl(event.target.value);
                      markDirty();
                    }}
                    required
                  />
                  <button className="button" type="submit" disabled={extracting}>
                    {extracting ? "Reading page…" : "Find recipe"}
                  </button>
                </form>
                <p className="field-note">
                  Your saved copy stays as it was when you added it. The original page is kept as its source.
                </p>
                {extractError && <p className="warning-note" role="status">{extractError}</p>}
                {draft && (
                  <RecipeEditor
                    key={entryPath}
                    draft={draft}
                    entryPath="import"
                    householdId={householdId}
                    warning={warning}
                    onChange={updateDraft}
                    onCancel={cancelEntry}
                    onOpenExisting={() => {
                      dirtyRef.current = false;
                    }}
                  />
                )}
              </section>
            )}

            {entryPath === "manual" && draft && (
              <section className="capture-card" aria-labelledby="manual-title">
                <p className="eyebrow">MAKE IT YOURS</p>
                <h2 id="manual-title">Create manually</h2>
                <RecipeEditor
                  key={entryPath}
                  draft={draft}
                  entryPath="manual"
                  householdId={householdId}
                  onChange={updateDraft}
                  onCancel={cancelEntry}
                  onOpenExisting={() => {
                    dirtyRef.current = false;
                  }}
                />
              </section>
            )}
          </>
        )}
      </section>

      <footer className="site-footer">
        <span>Made for the recipes worth keeping.</span>
        <span>Shared by {householdName}</span>
      </footer>
    </main>
  );
}

function RecipeEditor({
  draft,
  entryPath,
  householdId,
  warning,
  onChange,
  onCancel,
  onOpenExisting,
}: {
  draft: Draft;
  entryPath: EntryPath;
  householdId: string;
  warning?: string;
  onChange: (key: keyof Draft, value: string) => void;
  onCancel: () => void;
  onOpenExisting: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(
    saveRecipeAction,
    {},
  );
  const libraryUrl = `/?household=${encodeURIComponent(householdId)}`;

  return (
    <form className="recipe-editor" action={saveAction}>
      <input type="hidden" name="householdId" value={householdId} />
      {entryPath === "import" ? (
        <>
          <input type="hidden" name="sourceUrl" value={draft.sourceUrl ?? ""} />
          <div>
            <p className="eyebrow">REVIEW BEFORE SAVING</p>
            <h3>Make it yours to cook from.</h3>
          </div>
        </>
      ) : (
        <p className="field-note">Add at least one ingredient and one method step.</p>
      )}
      {warning && <p className="warning-note">{warning}</p>}
      <label>
        Recipe name
        <input
          name="title"
          value={draft.title}
          onChange={(event) => onChange("title", event.target.value)}
          maxLength={200}
          required
        />
      </label>
      <div className="editor-grid">
        <label>
          Ingredients <span className="field-note">One ingredient per line</span>
          <textarea
            name="ingredients"
            value={draft.ingredients.join("\n")}
            onChange={(event) => onChange("ingredients", event.target.value)}
            required
          />
        </label>
        <label>
          Method <span className="field-note">One step per line</span>
          <textarea
            name="method"
            value={draft.method.join("\n")}
            onChange={(event) => onChange("method", event.target.value)}
            required
          />
        </label>
      </div>
      {entryPath === "import" && draft.sourceUrl ? (
        <p className="source-note">
          Source: <a href={draft.sourceUrl} target="_blank" rel="noreferrer">{draft.sourceUrl}</a>
        </p>
      ) : (
        entryPath === "manual" && (
          <label>
            Source URL <span className="field-note">Optional</span>
            <input
              name="sourceUrl"
              type="url"
              inputMode="url"
              value={draft.sourceUrl ?? ""}
              onChange={(event) => onChange("sourceUrl", event.target.value)}
              placeholder="https://…"
            />
          </label>
        )
      )}
      <div className="editor-actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save to household"}
        </button>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {saveState.error && <p className="inline-error" role="alert">{saveState.error}</p>}
      {saveState.existingRecipe && (
        <p className="warning-note" role="status">
          This source is already in your household library.{" "}
          <Link
            href={`${libraryUrl}#recipe-${saveState.existingRecipe.id}`}
            onClick={onOpenExisting}
          >
            View “{saveState.existingRecipe.title}”
          </Link>
        </p>
      )}
    </form>
  );
}
