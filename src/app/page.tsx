import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { HouseholdSetup } from "@/components/household-setup";
import { InviteAcceptance } from "@/components/invite-acceptance";
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
        <Link
          className="wordmark"
          href={`/?household=${encodeURIComponent(household.id)}`}
        >
          RecipeRepo
        </Link>
        <div className="topbar-household">
          <h1>{household.name}</h1>
          {households.length > 1 && (
            <HouseholdSwitcher households={households} selectedId={household.id} />
          )}
        </div>
        <div className="topbar-actions">
          <Link
            className="member-email"
            href={`/settings?household=${encodeURIComponent(household.id)}`}
          >
            {user.email ?? "Account settings"}
          </Link>
          <form action={signOutAction}>
            <button className="button button-quiet button-small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="library-toolbar">
        <Link
          className="button button-small"
          href={`/recipes/add?household=${encodeURIComponent(household.id)}`}
        >
          Add Recipe
        </Link>
        <form className="search-form" action="/" method="get" role="search">
          <label className="sr-only" htmlFor="recipe-search">Search recipes</label>
          <input
            id="recipe-search"
            name="q"
            type="search"
            placeholder="Search recipes"
            defaultValue={params.q ?? ""}
          />
          <input type="hidden" name="household" value={household.id} />
          <button className="button button-small" type="submit">Search</button>
        </form>
      </div>

      <RecipeCollection
        householdId={household.id}
        recipes={recipes}
        archivedRecipes={archivedRecipes}
        query={params.q ?? ""}
      />
    </main>
  );
}

function SetupNotice({ message }: { message?: string }) {
  return (
    <main className="setup-shell">
      <div className="setup-card">
        <p className="brand-name">RecipeRepo</p>
        <p className="eyebrow">SETUP</p>
        <h1>Set up your recipe library.</h1>
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
