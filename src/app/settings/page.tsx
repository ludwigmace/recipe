import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { AccountSettings } from "@/components/account-settings";
import { HouseholdNameForm } from "@/components/household-name-form";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { InvitePanel } from "@/components/invite-panel";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ household?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  if (!hasSupabaseConfig()) redirect("/");

  const params = await searchParams;
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/");

  const { data: memberships, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });
  if (membershipError || !memberships?.length) redirect("/");

  const householdIds = memberships.map((membership) => membership.household_id);
  const { data: households, error: householdError } = await client
    .from("households")
    .select("id, name")
    .in("id", householdIds)
    .order("name", { ascending: true });
  if (householdError || !households?.length) redirect("/");

  const household = households.find((item) => item.id === params.household) ?? households[0];
  const libraryUrl = `/?household=${encodeURIComponent(household.id)}`;

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="wordmark" href={libraryUrl}>
          RecipeRepo
        </Link>
        <div className="topbar-household">
          <h1>{household.name}</h1>
          {households.length > 1 && (
            <HouseholdSwitcher
              households={households}
              selectedId={household.id}
              pathname="/settings"
            />
          )}
        </div>
        <div className="topbar-actions">
          <span className="member-email">{user.email}</span>
          <form action={signOutAction}>
            <button className="button button-quiet button-small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="settings-page">
        <Link className="recipe-back-link" href={libraryUrl}>← Recipe library</Link>
        <h1>Settings</h1>
        <div className="settings-grid">
          <AccountSettings
            key={household.id}
            email={user.email ?? ""}
            householdId={household.id}
          />
          <section className="settings-panel" aria-labelledby="household-settings-title">
            <h2 id="household-settings-title">Household</h2>
            <p>Change the name for this shared library.</p>
            <HouseholdNameForm
              key={`${household.id}-${household.name}`}
              householdId={household.id}
              householdName={household.name}
            />
          </section>
          <section className="settings-panel" aria-labelledby="invite-settings-title">
            <h2 id="invite-settings-title">Invitations</h2>
            <p>Invite someone to {household.name}.</p>
            <InvitePanel key={household.id} householdId={household.id} />
          </section>
        </div>
      </section>
    </main>
  );
}
