"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions";

export function InviteAcceptance({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, {});

  return (
    <main className="setup-shell">
      <section className="invite-accept-card">
        <span className="wordmark-mark" aria-hidden="true">R</span>
        <p className="eyebrow">YOU’RE INVITED</p>
        <h1>Pull up a chair.</h1>
        <p className="muted">
          Join this household’s shared recipe library. Everyone can add, edit,
          and restore recipes.
        </p>
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Joining…" : "Join household"}
          </button>
        </form>
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      </section>
    </main>
  );
}
