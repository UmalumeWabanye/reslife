import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type { Institution } from "@/lib/types";
import { createResidence } from "../actions";
import { ResidenceForm } from "../residence-form";

export const metadata: Metadata = { title: "Add residence" };

export default async function NewResidencePage() {
  const institutions = await api.get<Institution[]>("/institutions");
  return (
    <>
      <PageHeader title="Add residence" description="You'll add room types, rooms and beds on the next screen." />
      <Card>
        <ResidenceForm action={createResidence} institutions={institutions} submitLabel="Create residence" />
      </Card>
    </>
  );
}
