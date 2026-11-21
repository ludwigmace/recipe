import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { HouseholdSetup } from "@/components/household-setup";
import { InviteAcceptance } from "@/components/invite-acceptance";
import { InvitePanel } from "@/components/invite-panel";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { RecipeCollection } from "@/components/recipe-collection";
import { signOutAction } from "@/app/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRecipeLibrary } from "@/lib/recipe-library";
import { createSupabaseRecipeStore } from "@/lib/supabase/recipe-store";

interface PageProps {
  searchParams: Promise<{ q?: string; invite?: string; household?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const inviteToken = params.invite ?? "";

  if (!hasSupabaseConfig()) return <SetupNotice />;

  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const user = auth.user;
  if (!user) return <AuthPanel inviteToken={inviteToken} />;
  if (inviteToken) return <InviteAcceptance token={inviteToken} />;

  const { data: memberships, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (membershipError) {
    return <SetupNotice message="Could not load your household. Check the Supabase setup." />;
  }
  if (!memberships?.length) return <HouseholdSetup />;

  const householdIds = memberships.map((membership) => membership.household_id);
  const selectedId = householdIds.includes(params.household ?? "")
    ? params.household!
    : householdIds[0];

  const { data: households, error: householdError } = await client
    .from("households")
    .select("id, name")
    .in("id", householdIds)
    .order("name", { ascending: true });
  const household = households?.find((item) => item.id === selectedId);
  if (householdError || !household || !households) {
    return <SetupNotice message="Could not load your household." />;
  }

  const library = createRecipeLibrary(createSupabaseRecipeStore(client));
  const [recipes, archivedRecipes] = await Promise.all([
    library.search({ householdId: household.id, query: params.q ?? "" }),
    library.listArchived({ householdId: household.id }),
  ]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true">R</span>
          recipe
        </Link>
        <div className="topbar-actions">
          <span className="member-email">{user.email}</span>
          <form action={signOutAction}>
            <button className="button button-quiet button-small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">THE HOUSEHOLD COOKBOOK</p>
          <h1>{household.name}</h1>
          <p className="hero-copy">
            Keep the good recipes. Leave the ads behind.
          </p>
          {households.length > 1 && (
            <HouseholdSwitcher households={households} selectedId={household.id} />
          )}
        </div>
        <InvitePanel householdId={household.id} />
      </section>

      <RecipeCollection
        householdId={household.id}
        recipes={recipes}
        archivedRecipes={archivedRecipes}
        query={params.q ?? ""}
      />

      <footer className="site-footer">
        <span>Made for the recipes worth keeping.</span>
        <span>Shared by {household.name}</span>
      </footer>
    </main>
  );
}

function SetupNotice({ message }: { message?: string }) {
  return (
    <main className="setup-shell">
      <div className="setup-card">
        <span className="wordmark-mark" aria-hidden="true">R</span>
        <p className="eyebrow">A HOME FOR YOUR RECIPES</p>
        <h1>Keep the good recipes.</h1>
        <p className="muted">
          {message ??
            "Add your Supabase project settings to connect your household cookbook."}
        </p>
        <pre className="setup-command">cp .env.example .env.local</pre>
        <p className="setup-help">
          Then fill in the local Supabase URL and anon key. Start the local
          database with <code>npm run db:start</code>.
        </p>
      </div>
    </main>
  );
}
