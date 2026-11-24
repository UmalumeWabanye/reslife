"use client";

import { MaintenancePriorities, type MaintenancePriority, type MaintenanceStatus } from "@students/shared";
import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { fullName, maintenanceStatusMeta, priorityMeta } from "@/lib/labels";
import { replyToRequest, updateRequest } from "../actions";

export function UpdateForm({
  id,
  status,
  allowedStatuses,
  priority,
  assigneeId,
  staff,
}: {
  id: string;
  status: MaintenanceStatus;
  allowedStatuses: MaintenanceStatus[];
  priority: MaintenancePriority;
  assigneeId: string | null;
  staff: { id: string; firstName: string | null; lastName: string | null; email: string }[];
}) {
  const [state, action] = useActionState(updateRequest.bind(null, id), undefined);
  const closed = status === "CLOSED";

  return (
    <form action={action} className="space-y-4" key={`${status}-${priority}-${assigneeId}`}>
      <Alert>{state?.error}</Alert>
      <div>
        <label htmlFor="status" className="label">Status</label>
        <select id="status" name="status" defaultValue="" disabled={closed} className="input">
          <option value="">{maintenanceStatusMeta[status].label} (current)</option>
          {allowedStatuses.map((s) => (
            <option key={s} value={s}>
              → {maintenanceStatusMeta[s].label}
            </option>
          ))}
        </select>
        {status === "RESOLVED" && <p className="mt-1 text-xs text-slate-500">Waiting for the student to confirm it&apos;s fixed.</p>}
      </div>
      <div>
        <label htmlFor="priority" className="label">Priority</label>
        <select id="priority" name="priority" defaultValue={priority} disabled={closed} className="input">
          {MaintenancePriorities.map((p) => (
            <option key={p} value={p}>
              {priorityMeta[p].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assigneeId" className="label">Assigned to</label>
        <select id="assigneeId" name="assigneeId" defaultValue={assigneeId ?? ""} disabled={closed} className="input">
          <option value="">Nobody yet</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {fullName(s) === "—" ? s.email : fullName(s)}
            </option>
          ))}
        </select>
      </div>
      {!closed && <SubmitButton>Save changes</SubmitButton>}
    </form>
  );
}

export function ReplyForm({ id }: { id: string }) {
  const [state, action] = useActionState(replyToRequest.bind(null, id), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <Alert>{state?.error}</Alert>
      <label htmlFor="reply" className="sr-only">Reply to the student</label>
      <textarea id="reply" name="body" required rows={3} maxLength={2000} placeholder="Reply to the student…" className="input" />
      <SubmitButton pendingText="Sending…">Send reply</SubmitButton>
    </form>
  );
}
