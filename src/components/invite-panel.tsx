"use client";

import { useActionState, useState } from "react";
import { createInviteAction } from "@/app/actions";

export function InvitePanel({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(createInviteAction, {});
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
  }

  return (
    <div className="invite-box">
      <form action={action}>
        <input type="hidden" name="householdId" value={householdId} />
        <button className="button button-quiet button-small" type="submit" disabled={pending}>
          {pending ? "Making invite…" : "＋ Invite someone"}
        </button>
      </form>
      {state.inviteUrl && (
        <div className="invite-result">
          <span>Share this private invite link (expires in 7 days):</span>
          <a href={state.inviteUrl}>{state.inviteUrl}</a>
          <button className="text-button" type="button" onClick={copyInvite}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {state.error && <p className="inline-error" role="alert">{state.error}</p>}
    </div>
  );
}
