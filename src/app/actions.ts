"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecipeLibrary, type Recipe } from "@/lib/recipe-library";
import type { ActionState } from "@/lib/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseRecipeStore } from "@/lib/supabase/recipe-store";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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

  let saved: Recipe;
  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    saved = await library.save({
      householdId,
      actorId: user.id,
      title: field(formData, "title"),
      ingredients: lines(field(formData, "ingredients")),
      method: lines(field(formData, "method")),
      sourceUrl: field(formData, "sourceUrl"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the recipe." };
  }
  revalidatePath("/");
  redirect(`/?household=${encodeURIComponent(householdId)}#recipe-${saved.id}`);
}

export async function editRecipeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const client = await createSupabaseServerClient();
  if (!(await currentUser(client))) return { error: "Sign in before editing a recipe." };

  try {
    const library = createRecipeLibrary(createSupabaseRecipeStore(client));
    await library.edit({
      householdId: field(formData, "householdId"),
      recipeId: field(formData, "recipeId"),
      title: field(formData, "title"),
      ingredients: lines(field(formData, "ingredients")),
      method: lines(field(formData, "method")),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the recipe." };
  }
  revalidatePath("/");
  return { message: "Recipe updated for the household." };
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
