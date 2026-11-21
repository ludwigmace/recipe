"use client";

import { useActionState, useState } from "react";
import { updateHouseholdBadgesAction } from "@/app/actions";

export function BadgeSettings({
  householdId,
  availableBadges,
}: {
  householdId: string;
  availableBadges: string[];
}) {
  const [state, action, pending] = useActionState(updateHouseholdBadgesAction, {});
  const [badges, setBadges] = useState(availableBadges);
  const [newBadge, setNewBadge] = useState("");

  function addBadge() {
    const badge = newBadge.trim().toLowerCase();
    if (!badge || badges.includes(badge) || badge.length > 32 || badges.length >= 40) return;
    setBadges([...badges, badge]);
    setNewBadge("");
  }

  return (
    <form className="badge-settings-form" action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="badges" value={badges.join("\n")} />
      <p>Choose the badges people can add to recipes in this household.</p>
      <ul className="badge-settings-list">
        {badges.map((badge) => (
          <li key={badge}>
            <span className="pill">{badge}</span>
            <button
              className="text-button"
              type="button"
              aria-label={`Remove ${badge} badge`}
              onClick={() => setBadges(badges.filter((item) => item !== badge))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="badge-add-row">
        <label>
          Add a badge
          <input
            value={newBadge}
            maxLength={32}
            onChange={(event) => setNewBadge(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addBadge();
              }
            }}
            placeholder="e.g. pasta"
          />
        </label>
        <button
          className="button button-small button-quiet"
          type="button"
          disabled={!newBadge.trim() || badges.length >= 40}
          onClick={addBadge}
        >
          Add
        </button>
      </div>
      {badges.length >= 40 && <p className="field-note">You’ve reached the 40-badge limit.</p>}
      <button className="button button-small" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save badges"}
      </button>
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
      {state.message && <p className="inline-success" role="status">{state.message}</p>}
    </form>
  );
}
