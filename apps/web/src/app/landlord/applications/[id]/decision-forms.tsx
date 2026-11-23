"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { BedWithOccupant } from "@/lib/types";
import { decide } from "../actions";

type Mode = "ACCEPT" | "WAITLIST" | "REJECT";

export function DecisionForms({
  applicationId,
  freeBeds,
  preferredRoomTypeId,
  defaultStart,
  defaultEnd,
}: {
  applicationId: string;
  freeBeds: BedWithOccupant[];
  preferredRoomTypeId: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [mode, setMode] = useState<Mode>("ACCEPT");
  const [state, action] = useActionState(decide.bind(null, applicationId), undefined);

  // Requested room type first, then the rest.
  const groups = new Map<string, { name: string; beds: BedWithOccupant[] }>();
  for (const b of [...freeBeds].sort((a, b) => Number(b.room.roomType.id === preferredRoomTypeId) - Number(a.room.roomType.id === preferredRoomTypeId))) {
    const g = groups.get(b.room.roomType.id) ?? { name: b.room.roomType.name, beds: [] };
    g.beds.push(b);
    groups.set(b.room.roomType.id, g);
  }

  if (state?.ok) return <Alert tone="success">Decision saved. The student has been updated.</Alert>;

  const tabs: { mode: Mode; label: string }[] = [
    { mode: "ACCEPT", label: "Accept" },
    { mode: "WAITLIST", label: "Waitlist" },
    { mode: "REJECT", label: "Reject" },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.mode}
            role="tab"
            type="button"
            aria-selected={mode === t.mode}
            onClick={() => setMode(t.mode)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === t.mode ? "bg-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="decision" value={mode} />
        <Alert>{state?.error}</Alert>

        {mode === "ACCEPT" && (
          <>
            {freeBeds.length === 0 ? (
              <Alert tone="warning">No free beds in this residence. Waitlist the student or add rooms.</Alert>
            ) : (
              <div>
                <label htmlFor="bedId" className="label">Allocate bed</label>
                <select id="bedId" name="bedId" required className="input">
                  {[...groups.entries()].map(([rtId, g]) => (
                    <optgroup key={rtId} label={`${g.name}${rtId === preferredRoomTypeId ? " (requested)" : ""}`}>
                      {g.beds.map((b) => (
                        <option key={b.id} value={b.id}>
                          Room {b.room.label} · bed {b.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Rent is set from the bed&apos;s room type.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="startDate" className="label">Lease start</label>
                <input id="startDate" name="startDate" type="date" required defaultValue={defaultStart} className="input" />
              </div>
              <div>
                <label htmlFor="endDate" className="label">Lease end</label>
                <input id="endDate" name="endDate" type="date" required defaultValue={defaultEnd} className="input" />
              </div>
            </div>
          </>
        )}

        <div>
          <label htmlFor="note" className="label">Note to student {mode === "ACCEPT" ? "(optional)" : "(recommended)"}</label>
          <textarea id="note" name="note" rows={3} className="input" placeholder={mode === "REJECT" ? "Let them know why, kindly." : ""} />
        </div>

        <SubmitButton
          variant={mode === "ACCEPT" ? "success" : mode === "REJECT" ? "danger" : "secondary"}
          pendingText="Saving…">
          {mode === "ACCEPT" ? "Send offer" : mode === "WAITLIST" ? "Add to waitlist" : "Reject application"}
        </SubmitButton>
      </form>
    </div>
  );
}
