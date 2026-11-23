"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { addRooms, addRoomType } from "../actions";

export function AddRoomTypeForm({ residenceId }: { residenceId: string }) {
  const [state, action] = useActionState(addRoomType.bind(null, residenceId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const err = state?.fieldErrors;

  return (
    <form ref={ref} action={action} className="space-y-3">
      <Alert>{state?.error && !err ? state.error : null}</Alert>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rt-name">Name</label>
          <input id="rt-name" name="name" required placeholder="e.g. Single en-suite" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rt-occ">Beds per room</label>
          <input id="rt-occ" name="occupancy" type="number" min={1} max={12} defaultValue={1} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rt-rent">Rent (R/month)</label>
          <input id="rt-rent" name="monthlyRent" type="number" min={1} step="0.01" required className="input" />
          {err?.monthlyRentCents ? <p className="mt-1 text-xs text-red-700">{err.monthlyRentCents[0]}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="rt-dep">Deposit (R)</label>
          <input id="rt-dep" name="deposit" type="number" min={0} step="0.01" defaultValue={0} className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="rt-desc">Description (optional)</label>
          <input id="rt-desc" name="description" className="input" />
        </div>
      </div>
      <SubmitButton variant="secondary">Add room type</SubmitButton>
    </form>
  );
}

export function AddRoomsForm({ residenceId, roomTypeId, occupancy }: { residenceId: string; roomTypeId: string; occupancy: number }) {
  const [state, action] = useActionState(addRooms.bind(null, residenceId, roomTypeId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor={`labels-${roomTypeId}`}>Add rooms</label>
        <input id={`labels-${roomTypeId}`} name="labels" required placeholder="A101, A102 or 101-120" className="input" />
      </div>
      <div className="w-28">
        <label className="label" htmlFor={`beds-${roomTypeId}`}>Beds each</label>
        <input id={`beds-${roomTypeId}`} name="bedsPerRoom" type="number" min={1} max={12} defaultValue={occupancy} className="input" />
      </div>
      <SubmitButton variant="secondary" pendingText="Adding…">Add</SubmitButton>
      {state?.error ? <p className="w-full text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
