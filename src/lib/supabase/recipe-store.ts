import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recipe, RecipeStore } from "../recipe-library";

interface RecipeRow {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  ingredients: string[];
  method: string[];
  source_url: string | null;
  badges: string[] | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    householdId: row.household_id,
    actorId: row.created_by,
    title: row.title,
    ingredients: row.ingredients,
    method: row.method,
    sourceUrl: row.source_url,
    badges: row.badges ?? [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseRecipeStore(client: SupabaseClient): RecipeStore {
  return {
    async findBySource(householdId, sourceUrl) {
      const { data, error } = await client
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .eq("source_url", sourceUrl)
        .maybeSingle();
      throwIfError(error);
      return data ? fromRow(data as RecipeRow) : null;
    },

    async findById(householdId, recipeId) {
      const { data, error } = await client
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .eq("id", recipeId)
        .maybeSingle();
      throwIfError(error);
      return data ? fromRow(data as RecipeRow) : null;
    },

    async search(householdId, query) {
      let request = client
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("title", { ascending: true });
      if (query) {
        const escaped = query.replace(/[\\%_]/g, "\\$&");
        request = request.ilike("title", `%${escaped}%`);
      }
      const { data, error } = await request;
      throwIfError(error);
      return (data ?? []).map((row) => fromRow(row as RecipeRow));
    },

    async listArchived(householdId) {
      const { data, error } = await client
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .not("archived_at", "is", null)
        .order("updated_at", { ascending: false });
      throwIfError(error);
      return (data ?? []).map((row) => fromRow(row as RecipeRow));
    },

    async insert(recipe) {
      const { data, error } = await client
        .from("recipes")
        .insert({
          household_id: recipe.householdId,
          created_by: recipe.actorId,
          title: recipe.title,
          ingredients: recipe.ingredients,
          method: recipe.method,
          source_url: recipe.sourceUrl,
          badges: recipe.badges ?? [],
        })
        .select("*")
        .single();
      throwIfError(error);
      return fromRow(data as RecipeRow);
    },

    async update(householdId, recipeId, changes) {
      const update: Record<string, unknown> = {};
      if (changes.title !== undefined) update.title = changes.title;
      if (changes.ingredients !== undefined) update.ingredients = changes.ingredients;
      if (changes.method !== undefined) update.method = changes.method;
      if (changes.badges !== undefined) update.badges = changes.badges;
      if (changes.archivedAt !== undefined) update.archived_at = changes.archivedAt;

      const { data, error } = await client
        .from("recipes")
        .update(update)
        .eq("household_id", householdId)
        .eq("id", recipeId)
        .select("*")
        .maybeSingle();
      throwIfError(error);
      return data ? fromRow(data as RecipeRow) : null;
    },
  };
}
