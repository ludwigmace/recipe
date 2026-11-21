"use client";

import { useActionState, useState } from "react";
import { renameHouseholdAction } from "@/app/actions";

export function HouseholdNameForm({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const [state, action, pending] = useActionState(renameHouseholdAction, {});
  const [name, setName] = useState(householdName);
  const nameInputId = `household-name-${householdId}`;

  return (
    <form className="household-name-form" action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <label htmlFor={nameInputId}>
        Household name
        <input
          id={nameInputId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value.toLowerCase())}
          maxLength={80}
          required
        />
      </label>
      <button className="button button-small" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </button>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.message && <p className="inline-success" role="status">{state.message}</p>}
    </form>
  );
}
