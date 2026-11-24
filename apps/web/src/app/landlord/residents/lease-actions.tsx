"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui";
import { endLease, moveIn } from "./actions";

export function LeaseActions({ leaseId, status, studentName }: { leaseId: string; status: string; studentName: string }) {
  const [pending, start] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endState, endAction] = useActionState(endLease.bind(null, leaseId), undefined);

  if (status !== "PENDING_MOVE_IN" && status !== "ACTIVE") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "PENDING_MOVE_IN" && (
          <Button
            variant="success"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await moveIn(leaseId);
                setMoveError(r?.error ?? null);
              })
            }>
            {pending ? "Checking in…" : "Move in"}
          </Button>
        )}
        {!ending && (
          <Button variant="secondary" onClick={() => setEnding(true)}>
            {status === "ACTIVE" ? "Move out" : "Cancel lease"}
          </Button>
        )}
      </div>
      {moveError && <p className="text-xs text-red-700">{moveError}</p>}
      {ending && (
        <form action={endAction} className="w-72 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
          <p className="text-sm font-medium">
            {status === "ACTIVE" ? `Move ${studentName} out?` : `Cancel ${studentName}'s lease?`} Their bed becomes free.
          </p>
          <label className="block text-xs">
            Reason
            <select name="reason" className="input mt-1 py-1">
              <option value="ENDED">Lease ended normally</option>
              <option value="TERMINATED">Terminated early</option>
            </select>
          </label>
          <input name="note" placeholder="Note (optional)" className="input py-1" />
          {endState?.error && <p className="text-xs text-red-700">{endState.error}</p>}
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingText="Saving…">
              Confirm
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setEnding(false)}>
              Keep
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
