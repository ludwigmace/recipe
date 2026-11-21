"use client";

import { useActionState } from "react";
import { createHouseholdAction } from "@/app/actions";

export function HouseholdSetup() {
  const [state, action, pending] = useActionState(createHouseholdAction, {});

  return (
    <main className="setup-shell">
      <section className="household-card">
        <span className="wordmark-mark" aria-hidden="true">R</span>
        <p className="eyebrow">START YOUR SHARED COOKBOOK</p>
        <h1>Give it a name.</h1>
        <p className="muted">
          Create a household library, then invite the people you cook with.
        </p>
        <form className="household-form" action={action}>
          <label>
            Household name
            <input name="name" placeholder="The Mace kitchen" maxLength={80} required />
          </label>
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create household"}
          </button>
        </form>
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      </section>
    </main>
  );
}
