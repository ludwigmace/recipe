import { redirect } from "next/navigation";
import { RecipeBuilder } from "@/components/recipe-builder";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ household?: string }>;
}

export default async function AddRecipePage({ searchParams }: PageProps) {
  if (!hasSupabaseConfig()) redirect("/");

  const params = await searchParams;
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/");

  const { data: memberships, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", auth.user.id)
    .order("joined_at", { ascending: true });
  if (membershipError || !memberships?.length) redirect("/");

  const householdIds = memberships.map((membership) => membership.household_id);
  const selectedId = householdIds.includes(params.household ?? "")
    ? params.household!
    : householdIds[0];
  const { data: household, error: householdError } = await client
    .from("households")
    .select("id, name")
    .eq("id", selectedId)
    .maybeSingle();
  if (householdError || !household) redirect("/");

  return (
    <RecipeBuilder
      householdId={household.id}
      householdName={household.name}
    />
  );
}
