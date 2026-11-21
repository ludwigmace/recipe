"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction } from "@/app/actions";

export function AuthPanel({ inviteToken }: { inviteToken: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signIn, signInPending] = useActionState(signInAction, {});
  const [signUpState, signUp, signUpPending] = useActionState(signUpAction, {});
  const state = mode === "signin" ? signInState : signUpState;
  const pending = mode === "signin" ? signInPending : signUpPending;

  return (
    <main className="setup-shell">
      <section className="auth-card">
        <p className="brand-name">RecipeRepo</p>
        <p className="eyebrow">YOUR HOUSEHOLD COOKBOOK</p>
        <h1>{mode === "signin" ? "Welcome back." : "Make room at the table."}</h1>
        <p className="muted">
          {inviteToken
            ? "Sign in or create an account to join this household."
            : "Sign in to find the recipes your household has saved."}
        </p>
        {inviteToken && <p className="invite-note">You have a household invitation waiting.</p>}
        <form className="auth-form" action={mode === "signin" ? signIn : signUp}>
          {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>
          <button className="button" type="submit" disabled={pending}>
            {pending
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        {state.error && <p className="inline-error" role="alert">{state.error}</p>}
        {state.message && <p className="inline-success" role="status">{state.message}</p>}
        <p className="auth-switch">
          {mode === "signin" ? "New to the recipe library? " : "Already have an account? "}
          <button
            className="text-button"
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
