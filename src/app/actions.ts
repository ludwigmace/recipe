"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRecipeLibrary,
  normalizePreparationSteps,
  type PreparationStep,
  type Recipe,
} from "@/lib/recipe-library";
import { createLlmPreparationStepGenerator } from "@/lib/llm-recipe-extractor";
import type { ActionState, ExistingRecipeSummary } from "@/lib/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseRecipeStore } from "@/lib/supabase/recipe-store";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function rawField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function selectedBadges(formData: FormData): string[] {
  return [...new Set(
    formData.getAll("badge")
      .map((badge) => String(badge).trim().toLowerCase())
      .filter(Boolean),
  )];
}

async function validateRecipeBadges(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  householdId: string,
  badges: string[],
  alreadyAssigned: string[] = [],
): Promise<string | null> {
  const { data, error } = await client
    .from("households")
    .select("available_badges")
    .eq("id", householdId)
    .maybeSingle();
  if (error || !data) return "Could not load the household’s available badges.";
  const allowed = new Set([
    ...((data.available_badges as string[]) ?? []),
    ...alreadyAssigned,
  ]);
  return badges.every((badge) => allowed.has(badge))
    ? null
    : "Choose badges from the available list in Settings.";
}

async function siteUrl(): Promise<string> {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function currentUser(client: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const inviteToken = field(formData, "inviteToken");
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/");
}

export async function signUpAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const inviteToken = field(formData, "inviteToken");
  const origin = await siteUrl();
  const next = inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/";
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { message: "Check your email to finish creating your account, then sign in." };
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/");
}

export async function createHouseholdAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = field(formData, "name");
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before creating a household." };

  const { error } = await client.rpc("create_household", { p_name: name });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { message: "Household created." };
}

export async function renameHouseholdAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const householdId = field(formData, "householdId");
  const name = field(formData, "name");
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before renaming a household." };

  const { error } = await client.rpc("rename_household", {
    p_household_id: householdId,
    p_name: name,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { message: "Household name updated." };
}

export async function updateHouseholdBadgesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const householdId = field(formData, "householdId");
  const availableBadges = lines(field(formData, "badges"))
    .map((badge) => badge.toLowerCase())
    .filter((badge, index, all) => all.indexOf(badge) === index);
  if (availableBadges.length > 40) return { error: "Use at most 40 badges." };
  if (availableBadges.some((badge) => badge.length > 32)) {
    return { error: "Each badge must be 32 characters or fewer." };
  }

  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before managing badges." };

  const { error } = await client.rpc("update_household_badges", {
    p_household_id: householdId,
    p_badges: availableBadges,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { message: "Available badges updated." };
}

export async function updateAccountEmailAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = field(formData, "email");
  const householdId = field(formData, "householdId");
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before changing your email." };

  const next = `/settings?household=${encodeURIComponent(householdId)}`;
  const emailRedirectTo =
    `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await client.auth.updateUser(
    { email },
    { emailRedirectTo },
  );
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {
    message: "Check your current and new email addresses to confirm the change.",
  };
}

export async function updateAccountPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentPassword = rawField(formData, "currentPassword");
  const password = rawField(formData, "password");
  const passwordConfirmation = rawField(formData, "passwordConfirmation");
  const client = await createSupabaseServerClient();
  const user = await currentUser(client);
  if (!user?.email) return { error: "Sign in before changing your password." };
  if (!currentPassword) return { error: "Enter your current password." };
  if (password.length < 8) return { error: "Use at least 8 characters for your new password." };
  if (password !== passwordConfirmation) {
    return { error: "The new passwords do not match." };
  }

  const { error: signInError } = await client.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Your current password is incorrect." };

  const { error } = await client.auth.updateUser({ password });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { message: "Password updated." };
}

export async function createInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const householdId = field(formData, "householdId");
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before inviting a member." };

  const { data: token, error } = await client.rpc("create_household_invite", {
    p_household_id: householdId,
  });
  if (error || !token) return { error: error?.message ?? "Could not create an invitation." };
  return { inviteUrl: `${await siteUrl()}/?invite=${encodeURIComponent(token)}` };
}

export async function acceptInviteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = field(formData, "token");
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before accepting an invitation." };

  const { error } = await client.rpc("accept_household_invite", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath("/");
  redirect("/");
}

export async function saveRecipeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const householdId = field(formData, "householdId");
  const client = await createSupabaseServerClient();
  const user = await currentUser(client);
  if (!user) return { error: "Sign in before saving a recipe." };

  const badges = selectedBadges(formData);
  const badgeError = await validateRecipeBadges(client, householdId, badges);
  if (badgeError) return { error: badgeError };

  let saved: Recipe;
  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    const draft = {
      householdId,
      actorId: user.id,
      title: field(formData, "title"),
      ingredients: lines(field(formData, "ingredients")),
      method: lines(field(formData, "method")),
      sourceUrl: field(formData, "sourceUrl") || null,
      badges,
    };
    const result = await library.save(draft);
    if (result.wasDuplicate) {
      revalidatePath("/");
      return {
        existingRecipe: {
          id: result.recipe.id,
          title: result.recipe.title,
          archived: false,
        },
      };
    }
    saved = result.recipe;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the recipe." };
  }
  revalidatePath("/");
  redirect(`/?household=${encodeURIComponent(householdId)}#recipe-${saved.id}`);
}

export async function updateRecipeBadgesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before updating recipe badges." };

  const householdId = field(formData, "householdId");
  const recipeId = field(formData, "recipeId");
  const badges = selectedBadges(formData);
  const library = createRecipeLibrary(createSupabaseRecipeStore(client));

  try {
    const current = await library.findById({ householdId, recipeId });
    if (!current) return { error: "Recipe not found." };
    const badgeError = await validateRecipeBadges(
      client,
      householdId,
      badges,
      current.badges,
    );
    if (badgeError) return { error: badgeError };

    await library.setBadges({ householdId, recipeId, badges });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update recipe badges." };
  }

  revalidatePath("/");
  revalidatePath(`/recipes/${encodeURIComponent(recipeId)}`);
  return { message: "Recipe badges updated." };
}

export async function findRecipeBySourceAction(
  householdId: string,
  sourceUrl: string,
): Promise<ExistingRecipeSummary | null> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return null;

  const library = createRecipeLibrary(createSupabaseRecipeStore(client));
  const recipe = await library.findBySource({ householdId, sourceUrl });
  return recipe
    ? {
        id: recipe.id,
        title: recipe.title,
        archived: recipe.archivedAt !== null,
      }
    : null;
}

export async function editRecipeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before editing a recipe." };
  const householdId = field(formData, "householdId");
  const badges = selectedBadges(formData);
  const badgeError = await validateRecipeBadges(client, householdId, badges);
  if (badgeError) return { error: badgeError };

  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.edit({
      householdId,
      recipeId: field(formData, "recipeId"),
      title: field(formData, "title"),
      ingredients: lines(field(formData, "ingredients")),
      method: lines(field(formData, "method")),
      badges,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the recipe." };
  }
  revalidatePath("/");
  return { message: "Recipe updated for the household." };
}

export async function savePreparationStepsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) {
    return { error: "Sign in before saving preparation steps." };
  }

  const householdId = field(formData, "householdId");
  const recipeId = field(formData, "recipeId");
  let preparationSteps: PreparationStep[];
  try {
    preparationSteps = JSON.parse(field(formData, "preparationSteps")) as PreparationStep[];
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.setPreparationSteps({ householdId, recipeId, preparationSteps });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save preparation steps.",
    };
  }
  revalidatePath(`/recipes/${encodeURIComponent(recipeId)}`);
  return { message: "Preparation steps saved." };
}

export async function generatePreparationStepsAction(input: {
  householdId: string;
  recipeId: string;
}): Promise<{ steps?: PreparationStep[]; error?: string }> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) {
    return { error: "Sign in before generating preparation steps." };
  }

  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    const recipe = await library.findById(input);
    if (!recipe) return { error: "Recipe not found." };
    const steps = normalizePreparationSteps(
      await createLlmPreparationStepGenerator()(recipe),
    );
    return { steps };
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : "Could not generate preparation steps.",
    };
  }
}

export async function removePreparationStepsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) {
    return { error: "Sign in before removing preparation steps." };
  }

  const householdId = field(formData, "householdId");
  const recipeId = field(formData, "recipeId");
  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.setPreparationSteps({
      householdId,
      recipeId,
      preparationSteps: null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not remove preparation steps.",
    };
  }
  revalidatePath(`/recipes/${encodeURIComponent(recipeId)}`);
  return { message: "Preparation-step version removed." };
}

export async function archiveRecipeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before archiving a recipe." };

  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.archive({
      householdId: field(formData, "householdId"),
      recipeId: field(formData, "recipeId"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not archive the recipe." };
  }
  revalidatePath("/");
  return { message: "Recipe archived. It can be restored later." };
}

export async function restoreRecipeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before restoring a recipe." };

  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.restore({
      householdId: field(formData, "householdId"),
      recipeId: field(formData, "recipeId"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not restore the recipe." };
  }
  revalidatePath("/");
  return { message: "Recipe restored." };
}
