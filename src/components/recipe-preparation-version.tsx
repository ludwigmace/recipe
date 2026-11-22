"use client";

import { useActionState, useState } from "react";
import {
  generatePreparationStepsAction,
  removePreparationStepsAction,
  savePreparationStepsAction,
} from "@/app/actions";
import type { PreparationStep, Recipe } from "@/lib/recipe-library";
import type { ActionState } from "@/lib/action-state";

type StepDraft = {
  title: string;
  ingredients: string;
  method: string;
};

function toDrafts(steps: PreparationStep[]): StepDraft[] {
  return steps.map((step) => ({
    title: step.title,
    ingredients: step.ingredients.join("\n"),
    method: step.method.join("\n"),
  }));
}

function toPreparationSteps(steps: StepDraft[]): PreparationStep[] {
  return steps.map((step) => ({
    title: step.title.trim(),
    ingredients: step.ingredients
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    method: step.method
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  }));
}

export function RecipePreparationVersion({
  householdId,
  recipe,
}: {
  householdId: string;
  recipe: Recipe;
}) {
  const [selectedVersion, setSelectedVersion] = useState<"original" | "steps">("original");
  const [hasPreparationSteps, setHasPreparationSteps] = useState(
    recipe.preparationSteps !== null,
  );
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState<StepDraft[]>(
    recipe.preparationSteps ? toDrafts(recipe.preparationSteps) : [],
  );
  const [savedSteps, setSavedSteps] = useState<PreparationStep[] | null>(
    recipe.preparationSteps,
  );
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  function beginManualEntry() {
    setSteps([{ title: "Step 1", ingredients: "", method: "" }]);
    setGenerationError("");
    setEditing(true);
  }

  async function generateSteps() {
    setGenerationError("");
    setGenerating(true);
    try {
      const result = await generatePreparationStepsAction({
        householdId,
        recipeId: recipe.id,
      });
      if (result.error || !result.steps) {
        setGenerationError(result.error ?? "Could not generate preparation steps.");
        return;
      }
      setSteps(toDrafts(result.steps));
      setEditing(true);
    } catch {
      setGenerationError("Could not generate preparation steps.");
    } finally {
      setGenerating(false);
    }
  }

  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await savePreparationStepsAction(previous, formData);
      if (result.message) {
        setSavedSteps(toPreparationSteps(steps));
        setHasPreparationSteps(true);
        setEditing(false);
      }
      return result;
    },
    {},
  );

  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await removePreparationStepsAction(previous, formData);
      if (result.message) {
        setSavedSteps(null);
        setHasPreparationSteps(false);
        setSteps([]);
        setEditing(false);
      }
      return result;
    },
    {},
  );

  function updateStep(index: number, key: keyof StepDraft, value: string) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [key]: value } : step,
      ),
    );
  }

  function addIngredientToStep(index: number, ingredient: string) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              ingredients: [step.ingredients.trimEnd(), ingredient]
                .filter(Boolean)
                .join("\n"),
            }
          : step,
      ),
    );
  }

  function moveStep(index: number, offset: number) {
    setSteps((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  }

  return (
    <section className="recipe-versions" aria-label="Recipe versions">
      <div className="recipe-version-tabs" role="tablist" aria-label="Recipe version">
        <button
          type="button"
          role="tab"
          aria-selected={selectedVersion === "original"}
          className={selectedVersion === "original" ? "recipe-version-tab selected" : "recipe-version-tab"}
          onClick={() => setSelectedVersion("original")}
        >
          Original
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedVersion === "steps"}
          className={selectedVersion === "steps" ? "recipe-version-tab selected" : "recipe-version-tab"}
          onClick={() => setSelectedVersion("steps")}
        >
          By preparation step
        </button>
      </div>

      {selectedVersion === "original" ? (
        <div className="recipe-detail-columns" role="tabpanel">
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
      ) : (
        <div role="tabpanel" className="preparation-version-panel">
          {!hasPreparationSteps && !editing ? (
            <div className="preparation-empty">
              <p>This recipe doesn’t have a preparation-step version yet.</p>
              <div className="preparation-version-actions">
                <button className="button button-small" type="button" onClick={beginManualEntry}>
                  Build manually
                </button>
                <button
                  className="button button-small button-quiet"
                  type="button"
                  onClick={generateSteps}
                  disabled={generating}
                >
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
              </div>
            </div>
          ) : editing ? (
            <div className="preparation-editor">
              <div>
                <h2>{hasPreparationSteps ? "Edit preparation steps" : "Build preparation steps"}</h2>
                <p className="field-note">
                  Group the ingredients and instructions used in each step. The Original version stays unchanged.
                </p>
              </div>
              <form action={saveAction}>
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input
                  type="hidden"
                  name="preparationSteps"
                  value={JSON.stringify(toPreparationSteps(steps))}
                />
                <div className="preparation-step-editor-list">
                  {steps.map((step, index) => (
                    <fieldset className="preparation-step-editor" key={index}>
                      <legend>Preparation step {index + 1}</legend>
                      <label>
                        Step name
                        <input
                          value={step.title}
                          maxLength={100}
                          onChange={(event) => updateStep(index, "title", event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Ingredients for this step
                        <textarea
                          value={step.ingredients}
                          onChange={(event) => updateStep(index, "ingredients", event.target.value)}
                          placeholder="One ingredient per line"
                          rows={3}
                        />
                      </label>
                      <details className="preparation-ingredient-options">
                        <summary>Add an ingredient from Original</summary>
                        <div>
                          {recipe.ingredients.map((ingredient, ingredientIndex) => (
                            <button
                              className="text-button"
                              type="button"
                              key={`${ingredientIndex}-${ingredient}`}
                              onClick={() => addIngredientToStep(index, ingredient)}
                            >
                              + {ingredient}
                            </button>
                          ))}
                        </div>
                      </details>
                      <label>
                        Instructions
                        <textarea
                          value={step.method}
                          onChange={(event) => updateStep(index, "method", event.target.value)}
                          placeholder="One instruction per line"
                          rows={4}
                          required
                        />
                      </label>
                      <div className="preparation-step-controls">
                        <button className="text-button" type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                          Move up
                        </button>
                        <button className="text-button" type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>
                          Move down
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                          disabled={steps.length === 1}
                        >
                          Remove step
                        </button>
                      </div>
                    </fieldset>
                  ))}
                </div>
                <div className="preparation-version-actions">
                  <button
                    className="button button-small button-quiet"
                    type="button"
                    onClick={() =>
                      setSteps((current) => [
                        ...current,
                        {
                          title: `Step ${current.length + 1}`,
                          ingredients: "",
                          method: "",
                        },
                      ])
                    }
                    disabled={steps.length >= 50}
                  >
                    Add a step
                  </button>
                  <button className="button button-small" type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save step version"}
                  </button>
                  <button className="text-button" type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={generateSteps}
                    disabled={generating}
                  >
                    {generating ? "Generating…" : "Regenerate with AI"}
                  </button>
                </div>
                {saveState.error && <p className="inline-error" role="alert">{saveState.error}</p>}
                {generationError && <p className="inline-error" role="alert">{generationError}</p>}
              </form>
              {hasPreparationSteps && (
                <form action={removeAction}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <button className="text-button" type="submit" disabled={removing}>
                    {removing ? "Removing…" : "Remove step version"}
                  </button>
                  {removeState.error && <p className="inline-error" role="alert">{removeState.error}</p>}
                </form>
              )}
            </div>
          ) : (
            <div className="preparation-version-content">
              <div className="preparation-version-actions">
                <button className="button button-small button-quiet" type="button" onClick={() => setEditing(true)}>
                  Edit step version
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={generateSteps}
                  disabled={generating}
                >
                  {generating ? "Generating…" : "Regenerate with AI"}
                </button>
              </div>
              {generationError && <p className="inline-error" role="alert">{generationError}</p>}
              {savedSteps?.map((step, index) => (
                <section className="preparation-step" key={`${index}-${step.title}`}>
                  <h2>{step.title}</h2>
                  <div className="preparation-step-content">
                    {step.ingredients.length > 0 && (
                      <div>
                        <h3>Ingredients</h3>
                        <ul>
                          {step.ingredients.map((ingredient, ingredientIndex) => (
                            <li key={`${ingredientIndex}-${ingredient}`}>{ingredient}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <h3>Instructions</h3>
                      <ol>
                        {step.method.map((instruction, instructionIndex) => (
                          <li key={`${instructionIndex}-${instruction}`}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
          {generationError && !editing && !hasPreparationSteps && (
            <p className="inline-error" role="alert">{generationError}</p>
          )}
        </div>
      )}
    </section>
  );
}
