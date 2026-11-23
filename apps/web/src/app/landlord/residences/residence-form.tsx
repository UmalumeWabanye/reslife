"use client";

import { GenderPolicies, ResidenceTypes } from "@students/shared";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/api";
import { genderPolicyLabel, residenceTypeLabel } from "@/lib/labels";
import type { Institution, ResidenceDetail } from "@/lib/types";

export function ResidenceForm({
  action,
  institutions,
  residence,
  submitLabel,
}: {
  action: (prev: ActionState, f: FormData) => Promise<ActionState>;
  institutions: Institution[];
  residence?: ResidenceDetail;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const errors = state?.fieldErrors;
  const linked = new Map(residence?.institutions.map((i) => [i.institutionId, i.distanceKm]) ?? []);

  return (
    <form action={formAction} className="space-y-6">
      <Alert>{state?.error && state.error !== "Validation failed" ? state.error : state?.error ? "Please fix the highlighted fields." : null}</Alert>
      {state?.ok ? <Alert tone="success">Saved.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" errors={errors}>
          <input id="name" name="name" required defaultValue={residence?.name} className="input" />
        </Field>
        <Field label="Type" name="type" errors={errors}>
          <select id="type" name="type" defaultValue={residence?.type ?? "PRIVATE"} className="input">
            {ResidenceTypes.map((t) => (
              <option key={t} value={t}>
                {residenceTypeLabel[t]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" name="description" errors={errors} hint="What students should know: vibe, rules, what's included.">
            <textarea id="description" name="description" rows={4} required minLength={10} defaultValue={residence?.description} className="input" />
          </Field>
        </div>
        <Field label="Street address" name="addressLine" errors={errors}>
          <input id="addressLine" name="addressLine" required defaultValue={residence?.addressLine} className="input" />
        </Field>
        <Field label="City" name="city" errors={errors}>
          <input id="city" name="city" required defaultValue={residence?.city} className="input" />
        </Field>
        <Field label="Latitude" name="latitude" errors={errors} hint="From Google Maps: right-click the building → copy coordinates.">
          <input id="latitude" name="latitude" type="number" step="any" required defaultValue={residence?.latitude} className="input" />
        </Field>
        <Field label="Longitude" name="longitude" errors={errors}>
          <input id="longitude" name="longitude" type="number" step="any" required defaultValue={residence?.longitude} className="input" />
        </Field>
        <Field label="Gender policy" name="genderPolicy" errors={errors}>
          <select id="genderPolicy" name="genderPolicy" defaultValue={residence?.genderPolicy ?? "MIXED"} className="input">
            {GenderPolicies.map((g) => (
              <option key={g} value={g}>
                {genderPolicyLabel[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amenities" name="amenities" errors={errors} hint="Comma separated, e.g. Wi-Fi, Laundry, Gym">
          <input id="amenities" name="amenities" defaultValue={residence?.amenities.join(", ")} className="input" />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Funding</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="nsfasAccredited" defaultChecked={residence?.nsfasAccredited} className="size-4" />
          NSFAS accredited
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="bursaryFunded" defaultChecked={residence?.bursaryFunded} className="size-4" />
          Accepts bursary-funded students
        </label>
      </fieldset>

      <fieldset>
        <legend className="label">Institutions served</legend>
        <p className="mb-2 text-xs text-slate-500">Students only see residences linked to their institution.</p>
        {errors?.institutions ? <p className="mb-2 text-xs text-red-700">{errors.institutions[0]}</p> : null}
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {institutions.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                <input type="checkbox" name="institutionIds" value={i.id} defaultChecked={linked.has(i.id)} className="size-4" />
                {i.name} <span className="text-slate-400">({i.city})</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Distance
                <input
                  name={`distance_${i.id}`}
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={linked.get(i.id) ?? undefined}
                  className="input w-20 py-1"
                  aria-label={`Distance to ${i.shortName} in km`}
                />
                km
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand colour" name="primaryColour" errors={errors} hint="Used to theme the residence space in the student app.">
          <input id="primaryColour" name="primaryColour" type="color" defaultValue={residence?.primaryColour ?? "#2563EB"} className="h-10 w-20 rounded border border-slate-300" />
        </Field>
        <Field label="Logo URL (optional)" name="logoUrl" errors={errors}>
          <input id="logoUrl" name="logoUrl" type="url" defaultValue={residence?.logoUrl ?? ""} className="input" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={residence?.isPublished} className="size-4" />
        Published (visible to students once your organisation is verified)
      </label>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
