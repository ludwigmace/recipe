"use client";

import { useActionState } from "react";
import {
  updateAccountEmailAction,
  updateAccountPasswordAction,
} from "@/app/actions";

export function AccountSettings({
  email,
  householdId,
}: {
  email: string;
  householdId: string;
}) {
  const [emailState, emailAction, updatingEmail] = useActionState(
    updateAccountEmailAction,
    {},
  );
  const [passwordState, passwordAction, updatingPassword] = useActionState(
    updateAccountPasswordAction,
    {},
  );

  return (
    <section className="settings-panel" aria-labelledby="account-settings-title">
      <h2 id="account-settings-title">Account</h2>
      <p>Current email: {email}</p>
      <h3>Change email</h3>
      <form className="account-settings-form" action={emailAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <label>
          New email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder={email}
            required
          />
        </label>
        <button className="button button-small" type="submit" disabled={updatingEmail}>
          {updatingEmail ? "Sending…" : "Change email"}
        </button>
        {emailState.error && <p className="inline-error" role="alert">{emailState.error}</p>}
        {emailState.message && <p className="inline-success" role="status">{emailState.message}</p>}
      </form>

      <h3>Change password</h3>
      <form className="account-settings-form" action={passwordAction}>
        <label>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button className="button button-small" type="submit" disabled={updatingPassword}>
          {updatingPassword ? "Saving…" : "Change password"}
        </button>
        {passwordState.error && <p className="inline-error" role="alert">{passwordState.error}</p>}
        {passwordState.message && <p className="inline-success" role="status">{passwordState.message}</p>}
      </form>
    </section>
  );
}
