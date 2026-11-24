"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { postAnnouncement } from "./actions";

export function Composer({ residences, defaultResidenceId }: { residences: { id: string; name: string }[]; defaultResidenceId?: string }) {
  const [state, action] = useActionState(postAnnouncement, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const errors = state?.fieldErrors;

  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.ok ? (
        <Alert tone="success">
          Posted to {state.recipients} resident{state.recipients === 1 ? "" : "s"}.
        </Alert>
      ) : (
        <Alert>{state?.error && !errors ? state.error : null}</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Residence" name="residenceId" errors={errors}>
          <select id="residenceId" name="residenceId" required defaultValue={defaultResidenceId ?? residences[0]?.id} className="input">
            {residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Title" name="title" errors={errors}>
            <input id="title" name="title" required minLength={3} maxLength={120} placeholder="e.g. Water off on Tuesday 9am–12pm" className="input" />
          </Field>
        </div>
      </div>
      <Field label="Message" name="body" errors={errors}>
        <textarea id="body" name="body" required rows={4} maxLength={5000} className="input" />
      </Field>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pinned" className="size-4" />
          Pin to top
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="sendEmail" className="size-4" />
          Also email residents
        </label>
      </div>
      <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
    </form>
  );
}
